"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams, useRouter } from "next/navigation";
import { loginAuth, registerAuth, ApiError } from "@/lib/api-client";

type Tab = "signin" | "register";

/**
 * The login page view: a bare surface (no top bar) with two tabs — "Sign in"
 * and "Create account". Sign in takes email + password; Create account takes
 * email + password (min 8) + optional display name. On success, redirects to
 * the `next` query param if present, else to the locale root.
 *
 * The view is a client component — it owns its form state and auth fetches
 * in the browser (#87).
 */
export function LoginView() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /** Password must be at least 8 characters. */
  const passwordTooShort = password.length < 8;
  const canSubmit =
    email.trim() !== "" && password !== "" && !passwordTooShort && !submitting;

  /** Navigate to `next` if provided, else to the locale root. */
  function onSuccess() {
    router.replace(next ?? "/", { scroll: false });
  }

  /** Map an API error to a user-facing message key. */
  function toErrorMessage(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 401) return t("invalidCredentials");
      if (err.status === 409) return t("emailAlreadyInUse");
    }
    return t("genericError");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (tab === "signin") {
        await loginAuth(email, password);
        onSuccess();
      } else {
        // Registration does not start a session — the Create account flow is
        // done and the user now needs to sign in to begin one. Move them onto
        // the Sign in tab: keep the email, clear the (now committed) password.
        await registerAuth(email, password, displayName.trim() || null);
        setTab("signin");
        setPassword("");
      }
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex h-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Tabs */}
        <div className="mb-6 flex rounded-lg bg-surface-variant p-1">
          <button
            type="button"
            aria-pressed={tab === "signin"}
            onClick={() => { setTab("signin"); setError(null); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === "signin"
                ? "bg-primary text-on-primary-container"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t("tabSignIn")}
          </button>
          <button
            type="button"
            aria-pressed={tab === "register"}
            onClick={() => { setTab("register"); setError(null); }}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === "register"
                ? "bg-primary text-on-primary-container"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t("tabCreateAccount")}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-on-surface">
              {t("email")}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="rounded-lg border border-surface-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>

          {/* Display name (register only) */}
          {tab === "register" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="displayName" className="text-sm font-medium text-on-surface">
                {t("displayName")}
              </label>
              <input
                id="displayName"
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t("displayNamePlaceholder")}
                className="rounded-lg border border-surface-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
              />
            </div>
          )}

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium text-on-surface">
              {t("password")}
            </label>
            <input
              id="password"
              type="password"
              autoComplete={tab === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="rounded-lg border border-surface-variant bg-surface px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary"
            />
            {tab === "register" && password.length > 0 && passwordTooShort && (
              <p className="text-xs text-error">
                {t("passwordTooShort")}
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="mt-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed disabled:opacity-50"
          >
            {submitting
              ? t("submitting")
              : tab === "signin"
                ? t("submitSignIn")
                : t("submitCreateAccount")}
          </button>
        </form>
      </div>
    </main>
  );
}
