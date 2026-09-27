import { redirect } from "next/navigation";

/**
 * Catch-all for every URL under a locale that no route handles
 * (`/en/anything`, `/en/anything/deep`, …). It redirects to the
 * session list — the locale home page — so unknown paths never 404.
 * The home route itself is more specific and takes precedence over
 * this segment. Invalid locales are guarded by the `[locale]`
 * layout via `notFound()`.
 */
export default async function UnknownPathRedirect({
  params,
}: {
  params: Promise<{ locale: string; all: string[] }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}`);
}
