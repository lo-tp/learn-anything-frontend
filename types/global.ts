import { routing } from "@/i18n/routing";
import messages from "@/messages/en.json";

// Augment next-intl's default `AppConfig` so `useTranslations('ns')` /
// `getTranslations` are fully typed: the locale is restricted to the app's
// locales and message keys + ICU arguments are checked against the en
// catalog (the generated `messages/en.d.json.ts` supplies the literal
// message strings; without it, values degrade to `string` and only key
// checking is skipped, never erroring).
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
