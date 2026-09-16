import { Root } from "@/views/root";
import { listSessions, type SessionListItem } from "@/lib/api-client";
import { setRequestLocale } from "next-intl/server";
import { hasLocale, routing } from "@/i18n/routing";

/**
 * Render per request, not as a build-time snapshot — the History is resolved
 * against the backend at request time.
 */
export const dynamic = "force-dynamic";

/**
 * Home route: fetch the learner's History (all phases, newest first — #46)
 * and hand it to the home page in `views/root/index.tsx`, which owns the
 * interactive logic and renders it from pure components. If the backend is
 * unreachable on first paint we degrade to the empty state; the client
 * refresh can retry. The shared frame is applied by the root layout.
 */
export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(hasLocale(locale) ? locale : routing.defaultLocale);

  let sessions: SessionListItem[] = [];
  try {
    ({ sessions } = await listSessions());
  } catch {
    /* backend unreachable → render the empty state */
  }
  return <Root initialSessions={sessions} />;
}
