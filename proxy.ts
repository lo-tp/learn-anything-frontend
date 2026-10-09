import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

/**
 * Composed proxy: i18n locale routing only.
 *
 * The sign-in gate was removed (#149): the edge no longer verifies tokens
 * or redirects to a login page. Verification of the token belongs to the
 * backend alone. The sign-in affordance is the modal from #147.
 */
export default function proxy(request: NextRequest): NextResponse {
  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
