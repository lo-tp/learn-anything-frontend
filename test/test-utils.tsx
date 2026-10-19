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
 * jsdom has no `window.visualViewport`, and that is exactly where
 * `lib/keyboard-inset.ts` reads the keyboard inset from — so a test puts one on
 * `window`, keeps the handlers the page registers, and drives the two events a
 * real keyboard causes (#230). Without it nothing in this suite can say what a
 * surface does when a phone takes half the screen away.
 */
export type StubbedVisualViewport = {
  /** The keyboard opening, or closing. */
  resizeTo: (next: { height: number }) => void;
  /** What the page registered on it, so a test can assert none are left. */
  handlers: Map<string, EventListener>;
  /** Take the stand-in back off `window`. */
  restore: () => void;
};

export function stubVisualViewport({
  innerHeight,
  height,
  scale = 1,
}: {
  innerHeight: number;
  height: number;
  scale?: number;
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
  const handlers = new Map<string, EventListener>();
  const visual = { height, scale };
  const viewport = {
    get height() {
      return visual.height;
    },
    get scale() {
      return visual.scale;
    },
    addEventListener: (type: string, handler: EventListener) => {
      handlers.set(type, handler);
    },
    removeEventListener: (type: string, handler: EventListener) => {
      if (handlers.get(type) === handler) handlers.delete(type);
    },
  };
  (window as unknown as { visualViewport: unknown }).visualViewport = viewport;
  return {
    handlers,
    resizeTo: ({ height: next }) => {
      visual.height = next;
      handlers.get("resize")?.(new Event("resize"));
    },
    restore: () => {
      delete (window as unknown as { visualViewport?: unknown }).visualViewport;
      if (originalInnerHeight) {
        Object.defineProperty(window, "innerHeight", originalInnerHeight);
      }
    },
  };
}
