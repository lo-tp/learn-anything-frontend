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
