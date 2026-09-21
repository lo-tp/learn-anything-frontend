import { Session } from "@/views/session";
import { setRequestLocale } from "next-intl/server";
import { hasLocale, routing } from "@/i18n/routing";

/**
 * Session route: a static shell. It renders the session view and nothing
 * else — the view owns its initial and refresh fetches (session state and
 * materials) in the browser (#87). The view renders the friendly not-found /
 * not-ready states itself, so there is no `notFound()`. The shared frame is
 * applied by the root layout.
 */
export default async function SessionPage({
  params,
}: PageProps<"/[locale]/session/[sessionId]">) {
  const { locale, sessionId } = await params;
  setRequestLocale(hasLocale(locale) ? locale : routing.defaultLocale);
  return <Session sessionId={sessionId} />;
}
