import { redirect } from "next/navigation";

/**
 * Catch-all for every URL under a locale that no route handles
 * (`/en/anything`, `/en/anything/deep`, …). It redirects to the
 * personal list at `/mine` — the app's home — so unknown paths never
 * 404. The home routes themselves are more specific and take
 * precedence over this segment. Invalid locales are guarded by the
 * `[locale]` layout via `notFound()`.
 */
export default async function UnknownPathRedirect({
  params,
}: {
  params: Promise<{ locale: string; all: string[] }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/mine`);
}
