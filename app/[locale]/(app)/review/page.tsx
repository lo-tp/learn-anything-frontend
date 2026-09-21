import { Review } from "@/views/review";
import { setRequestLocale } from "next-intl/server";
import { hasLocale, routing } from "@/i18n/routing";

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
