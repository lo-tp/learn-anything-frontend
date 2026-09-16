import { locale as requestLocale } from "next/root-params";
import { getRequestConfig } from "next-intl/server";
import { hasLocale, routing } from "./routing";

/**
 * Per-request i18n config: resolves the current locale from the `[locale]`
 * root segment (via `next/root-params` — the compiler swaps in the real
 * segment value) and loads that locale's message catalog. Unknown or
 * absent segments fall back to the default locale.
 */
export default getRequestConfig(async () => {
  const segment = await requestLocale();
  const locale = hasLocale(segment) ? segment : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
