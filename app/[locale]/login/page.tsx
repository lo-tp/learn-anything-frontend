import { Suspense } from "react";
import { LoginView } from "@/views/login";
import { setRequestLocale } from "next-intl/server";
import { hasLocale, routing } from "@/i18n/routing";

/**
 * Login route: a static shell rendered bare (no top bar). It is outside the
 * `(app)` route group so the frame does not apply. The view owns its auth
 * fetches in the browser (#87).
 */
export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(hasLocale(locale) ? locale : routing.defaultLocale);
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
