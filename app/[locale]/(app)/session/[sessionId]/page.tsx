import type { Metadata } from "next";
import { Session } from "@/views/session";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale, routing } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
}): Promise<Metadata> {
  const { locale, sessionId } = await params;
  const resolved = hasLocale(locale) ? locale : routing.defaultLocale;
  const t = await getTranslations({ locale: resolved, namespace: "session" });

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  let title: string = t("learningSession");
  if (backendUrl) {
    try {
      const res = await fetch(`${backendUrl}/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.narrowed_goal) title = data.narrowed_goal;
      }
    } catch {
      /* fall back to the generic title */
    }
  }
  return { title };
}

/**
 * Session route: a static shell. It renders the session view and nothing
 * else — the view owns its initial and refresh fetches (session state and
 * materials) in the browser (#87). One address, two audiences (#151): the
 * same route serves a signed-in User and a Visitor; the view settles the
 * viewer's identity and the miss-writing policy. The view renders the
 * friendly not-found / not-ready states itself, so there is no
 * `notFound()`. The shared frame is applied by the root layout.
 */
export default async function SessionPage({
  params,
}: {
  params: Promise<{ locale: string; sessionId: string }>;
}) {
  const { locale, sessionId } = await params;
  setRequestLocale(hasLocale(locale) ? locale : routing.defaultLocale);
  return <Session sessionId={sessionId} />;
}
