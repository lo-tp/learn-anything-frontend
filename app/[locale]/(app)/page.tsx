import type { Metadata } from "next";
import { Explore } from "@/views/explore";
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
  return { title: t("explore") };
}

/**
 * The site root (#150): the public Explore surface — what people are
 * learning. A static shell pre-rendered per locale; the view owns its feed
 * fetch in the browser (#87). The feed is public (#144) and the edge no
 * longer gates (#149), so a Visitor reaches it as-is — signed-in and
 * Visitor look the same here. The shared frame is applied by the app
 * layout.
 */
export default async function ExplorePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(hasLocale(locale) ? locale : routing.defaultLocale);
  return <Explore />;
}
