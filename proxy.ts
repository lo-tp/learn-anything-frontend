import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing, type Locale } from "@/i18n/routing";
import { verifySignInToken } from "@/lib/auth";

const intlMiddleware = createMiddleware(routing);

/** Paths (after locale prefix) that are never gated. */
const UNPROTECTED = new Set(["login", "login/"]);

/**
 * Determine the effective locale for a request path.
 *
 * If the path already carries a locale prefix (`/en/…`, `/zh/…`), that
 * locale is used. Otherwise the `Accept-Language` header decides:
 * any `zh*` → `zh`, anything else/absent → `en`.
 */
function resolveLocale(pathname: string, acceptLanguage: string | null): Locale {
  const m = pathname.match(/^\/([a-z]{2})(\/|$)/);
  if (m) {
    const candidate = m[1];
    if ((routing.locales as readonly string[]).includes(candidate)) {
      return candidate as Locale;
    }
  }
  return acceptLanguage?.toLowerCase().startsWith("zh") ? "zh" : "en";
}

/**
 * Composed proxy: i18n locale routing + sign-in gate.
 *
 * 1. The locale is resolved from the path prefix or `Accept-Language`.
 * 2. Requests to the login route are passed straight through to the
 *    locale middleware (never gated).
 * 3. All other requests require a valid `access_token` cookie (HS256 JWT
 *    signed with `JWT_SECRET`). Missing, invalid, or expired tokens are
 *    redirected to `/{locale}/login?next=<original-path>`.
 */
export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const locale = resolveLocale(pathname, request.headers.get("accept-language"));

  // Strip the locale prefix (or leading slash) to get the clean route path.
  const cleanPath = pathname.startsWith(`/${locale}/`)
    ? pathname.slice(locale.length + 2)
    : pathname.startsWith(`/${locale}`)
      ? pathname.slice(locale.length + 1)
      : pathname.slice(1);

  // Login route is never gated.
  if (UNPROTECTED.has(cleanPath)) {
    return intlMiddleware(request);
  }

  // Verify sign-in cookie.
  const token = request.cookies.get("access_token")?.value;
  const secret = process.env.JWT_SECRET;
  if (token && secret && (await verifySignInToken(token, secret))) {
    return intlMiddleware(request);
  }

  // No valid token → redirect to login, preserving the intended path.
  const next = encodeURIComponent(pathname);
  return NextResponse.redirect(new URL(`/${locale}/login?next=${next}`, request.url));
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
