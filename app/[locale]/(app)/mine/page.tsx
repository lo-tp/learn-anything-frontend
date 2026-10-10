import type { Metadata } from "next";
import { Mine } from "@/views/mine";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale, routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: hasLocale(locale) ? locale : routing.defaultLocale,
    namespace: "topbar",
  });
  return { title: t("study") };
}

/**
 * The personal list route: a static shell pre-rendered per locale. It
 * renders the personal list view and nothing else — the view owns its
 * Session fetch (initial and refresh) in the browser (#87). A Visitor's
 * list fetch answers 401 and the sign-in modal asks in place over the page
 * (#147); the site root is the public Explore surface (#150). The shared
 * frame is applied by the app layout.
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
