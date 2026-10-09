import { Mine } from "@/views/mine";
import { setRequestLocale } from "next-intl/server";
import { hasLocale, routing } from "@/i18n/routing";

/**
 * The personal list route: a static shell pre-rendered per locale. It
 * renders the personal list view and nothing else — the view owns its
 * Session fetch (initial and refresh) in the browser (#87). A Visitor's
 * list fetch answers 401 and the sign-in modal asks in place over the page
 * (#147); the root temporary-redirects here until the public surface takes
 * it over (#148). The shared frame is applied by the app layout.
 */
export default async function MinePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(hasLocale(locale) ? locale : routing.defaultLocale);
  return <Mine />;
}
