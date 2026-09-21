import { Root } from "@/views/root";
import { setRequestLocale } from "next-intl/server";
import { hasLocale, routing } from "@/i18n/routing";

/**
 * Home route: a static shell pre-rendered per locale. It renders the home
 * view and nothing else — the view owns its History fetch (initial and
 * refresh) in the browser (#87). The shared frame is applied by the root
 * layout.
 */
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(hasLocale(locale) ? locale : routing.defaultLocale);
  return <Root />;
}
