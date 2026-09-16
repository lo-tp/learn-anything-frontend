import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/**
 * Locale detection + prefix routing (replaces hand-rolled `resolveLocale`):
 * a locale-less path is redirected to `/{locale}{pathname}` based on
 * `Accept-Language` (any `zh*` → `zh`, anything else/absent → `en`);
 * `/en` and `/zh` prefixes pass through; API routes and static assets are
 * never touched. Dotted paths (`/palette.css`, …) are excluded so `public/`
 * files keep being served at their root URLs — the middleware would
 * otherwise locale-redirect them to `/en/…`, where they don't exist.
 */
export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
