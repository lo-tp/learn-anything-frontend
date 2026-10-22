import { useState, type ReactElement, type ReactNode } from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

/** The locales the app serves (mirrors `routing.locales`). */
export type TestLocale = "en" | "zh";

/**
 * The message catalog for each test locale (the real production files). The
 * double assertion lets the zh catalog stand in for the en-typed `messages`
 * prop (identical key shapes — enforced by `test/lib/i18n.test.ts`).
 */
const catalogs = { en, zh } as unknown as Record<TestLocale, typeof en>;

/**
 * Render `ui` wrapped in a `NextIntlClientProvider` with the real message
 * catalog for the given locale — the unit-test stand-in for the `[locale]`
 * layout's provider, so components' `useTranslations`/`useLocale` calls
 * resolve against the production catalogs.
 */
export function renderWithLocale(
  ui: ReactElement,
  { locale = "en" }: { locale?: TestLocale } = {},
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]}>
      {ui}
    </NextIntlClientProvider>,
  );
}

/**
 * Render `children` in a `NextIntlClientProvider` whose locale is React
 * state, with a "switch language" button that flips it — the unit-test
 * stand-in for the language switcher: in the app the switch re-routes to
 * the same page under the other locale prefix, so the view stays mounted
 * and only its provider's locale changes (#205).
 */
export function LocaleHarness({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<TestLocale>("en");
  return (
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]}>
      {children}
      <button
        type="button"
        onClick={() => setLocale(locale === "en" ? "zh" : "en")}
      >
        switch language
      </button>
    </NextIntlClientProvider>
  );
}

/**
 * Claim the box a browser would lay the line out into.
 *
 * jsdom performs no layout: every element reports `offsetWidth` and
 * `scrollWidth` of 0, so a component that measures whether a `truncate` line
 * is hiding text (`isClipped` in `components/ui/tooltip.tsx`) can only ever
 * see "nothing hidden". `clip(line, true)` states what the real layout would
 * — the text is wider than the room the line was given — so the tests can
 * exercise the measurement branch and the refusal next to it.
 */
export function clip(el: HTMLElement, hidden: boolean) {
  const boxWidth = 200;
  const textWidth = hidden ? 900 : boxWidth;
  Object.defineProperty(el, "offsetWidth", { value: boxWidth, configurable: true });
  Object.defineProperty(el, "scrollWidth", { value: textWidth, configurable: true });
  return el;
}

/**
 * The room on screen a browser leaves the app, as a test states it.
 *
 * jsdom has no `window.visualViewport`, and that is exactly what
 * `lib/visual-viewport.ts` measures the room from — so a test puts one on
 * `window`, keeps the handlers the page registers, and drives the events a real
 * keyboard causes (#230). Without it nothing in this suite can say what a surface
 * does when a phone takes half the screen away.
 */
export type StubbedVisualViewport = {
  /**
   * The keyboard opening, or closing — and where it leaves the room. Pass
   * `innerHeight` as well to state a browser that resizes its *own* layout
   * viewport for the keyboard (`interactive-widget=resizes-content`, Chrome from
   * 108): the two viewports stay equal, so the room the app is told about *is*
   * the shorter layout viewport, and a surface is asked only to run its scroll,
   * never to pad anything (#230).
   */
  resizeTo: (next: {
    height: number;
    offsetTop?: number;
    innerHeight?: number;
  }) => void;
  /** The browser panning the layout viewport after a focused field: the room
   *  is the same size, it has simply moved. */
  panTo: (offsetTop: number) => void;
  /** What the page registered on it — `resize` and `scroll`, each of which can
   *  carry several listeners, so a test can assert none are left. */
  handlers: Map<string, Set<EventListener>>;
  /** Every registration, including repeats: how many times the page decided
   *  it needed its own listener. */
  added: string[];
  /** Take the stand-in back off `window`. */
  restore: () => void;
};

/**
 * Stand in for the browser's own measure of the room on screen: the layout
 * viewport (`window.innerHeight`) and the visual viewport inside it.
 */
export function stubVisualViewport({
  innerHeight,
  height,
  offsetTop = 0,
}: {
  innerHeight: number;
  height: number;
  offsetTop?: number;
}): StubbedVisualViewport {
  const originalInnerHeight = Object.getOwnPropertyDescriptor(
    window,
    "innerHeight",
  );
  Object.defineProperty(window, "innerHeight", {
    value: innerHeight,
    configurable: true,
    writable: true,
  });
  /** One event type, many listeners — as a browser has them. The shell holds one
   *  measurement of the room for the whole page and every surface that acts on it
   *  joins that one measurement, so a stand-in that kept only the last listener to
   *  register would tell the page there was nobody else listening (#230). */
  const handlers = new Map<string, Set<EventListener>>();
  const added: string[] = [];
  const fire = (type: string) => {
    for (const handler of [...(handlers.get(type) ?? [])]) {
      handler(new Event(type));
    }
  };
  const visual = { height, offsetTop };
  const setInnerHeight = (value: number) => {
    Object.defineProperty(window, "innerHeight", {
      value,
      configurable: true,
      writable: true,
    });
  };
  const viewport = {
    get height() {
      return visual.height;
    },
    get offsetTop() {
      return visual.offsetTop;
    },
    addEventListener: (type: string, handler: EventListener) => {
      added.push(type);
      const registered = handlers.get(type) ?? new Set<EventListener>();
      registered.add(handler);
      handlers.set(type, registered);
    },
    removeEventListener: (type: string, handler: EventListener) => {
      const registered = handlers.get(type);
      if (!registered) return;
      registered.delete(handler);
      if (registered.size === 0) handlers.delete(type);
    },
  };
  (window as unknown as { visualViewport: unknown }).visualViewport = viewport;
  return {
    handlers,
    added,
    resizeTo: ({
      height: nextHeight,
      offsetTop: nextOffset,
      innerHeight: nextInnerHeight,
    }) => {
      visual.height = nextHeight;
      if (nextOffset !== undefined) visual.offsetTop = nextOffset;
      if (nextInnerHeight !== undefined) setInnerHeight(nextInnerHeight);
      fire("resize");
    },
    panTo: (offset: number) => {
      visual.offsetTop = offset;
      fire("scroll");
    },
    restore: () => {
      delete (window as unknown as { visualViewport?: unknown }).visualViewport;
      if (originalInnerHeight) {
        Object.defineProperty(window, "innerHeight", originalInnerHeight);
      }
    },
  };
}
