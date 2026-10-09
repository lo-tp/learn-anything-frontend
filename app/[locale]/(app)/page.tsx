import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { hasLocale, routing } from "@/i18n/routing";

/**
 * The root route: a temporary (307) redirect to the personal list at
 * `/mine` (#148). The personal list moved to its own address, and the root
 * is held open by this redirect so no existing link or bookmark breaks
 * while the public surface is built here — when that surface lands, this
 * page becomes the public home instead of a redirect.
 */
export default async function Root({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(hasLocale(locale) ? locale : routing.defaultLocale);
  redirect(`/${locale}/mine`);
}
