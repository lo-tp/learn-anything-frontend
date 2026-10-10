import type { Metadata } from "next";
import { Review } from "@/views/review";
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
  return { title: t("review") };
}

/**
 * Review route: a static shell. It renders the review view and nothing
 * else — the view owns its initial `getReviewDue` fetch and the card flow
 * in the browser (#87). The view renders its own loading / error /
 * empty states, so there is no `notFound()`. The shared frame is applied
 * by the app layout.
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(hasLocale(locale) ? locale : routing.defaultLocale);
  return <Review />;
}
