import { defineRouting } from "next-intl/routing";

/**
 * The locales the app serves, plus the routing behavior shared by the
 * proxy (locale detection/redirects) and the navigation helpers.
 *
 * The path prefix is the source of truth — there is deliberately no
 * `localeCookie`, so a locale-less path is resolved from `Accept-Language`
 * on every request and never persisted.
 */
export const routing = defineRouting({
  locales: ["en", "zh"],
  defaultLocale: "en",
  localeCookie: false,
});

/** The app's locales, as a union type. */
export type Locale = (typeof routing.locales)[number];

/**
 * Type guard for raw locale values (route segments, `Accept-Language`
 * tags). `defineRouting` has no built-in equivalent.
 */
export function hasLocale(value: string | null | undefined): value is Locale {
  return (
    value !== null &&
    value !== undefined &&
    (routing.locales as readonly string[]).includes(value)
  );
}

/** The BCP-47 tag used for `<html lang>` and `Intl` formatting. */
export function localeTag(locale: Locale): string {
  return locale === "zh" ? "zh-CN" : "en";
}
