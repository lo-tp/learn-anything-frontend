"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { loginAuth, registerAuth, ApiError } from "@/lib/api-client";

type Tab = "signin" | "register";

/** The form's tab picker — a checked/unchecked ink block. */
function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-ring flex flex-1 items-center gap-2 rounded-[3px] border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.12em] transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-outline-variant text-on-surface-variant hover:border-primary hover:text-on-surface",
      )}
    >
      <span aria-hidden className="flex size-3.5 items-center justify-center rounded-[2px] border border-current">
        {active ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      {label}
    </button>
  );
}

/**
 * The sign-in form: two tabs — "Sign in" and "Create account". Sign in takes
 * email + password; Create account takes email + password (min 8) + optional
 * display name. On a successful sign-in it calls `onSuccess` and does nothing
 * else — no navigation: the host decides what happens next (the sign-in
 * modal closes in place, #147; the login page redirects to its `next`
 * target). Registration does not start a session: it hands the person to
 * the Sign in tab with their email kept and the password cleared.
 *
 * One form, two hosts (#147): the sign-in modal over the current surface,
 * and the standalone login page.
 */
export function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations("auth");

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
    <>
      {/* Tabs — form checkboxes: the picked tab is inked solid. */}
      <div className="mb-6 flex gap-2">
        <TabButton
          label={t("tabSignIn")}
          active={tab === "signin"}
          onClick={() => { setTab("signin"); setError(null); }}
        />
        <TabButton
          label={t("tabCreateAccount")}
          active={tab === "register"}
          onClick={() => { setTab("register"); setError(null); }}
        />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface">
            {t("email")}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-md border border-input bg-surface-container-lowest px-3 py-2.5 text-[15px] text-on-surface outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
          />
        </div>

        {/* Display name (register only) */}
        {tab === "register" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="displayName" className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface">
              {t("displayName")}
            </label>
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("displayNamePlaceholder")}
              className="rounded-md border border-input bg-surface-container-lowest px-3 py-2.5 text-[15px] text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
            />
          </div>
        )}

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface">
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
            className="rounded-md border border-input bg-surface-container-lowest px-3 py-2.5 text-[15px] text-on-surface outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
          />
          {tab === "register" && password.length > 0 && passwordTooShort && (
            <p className="font-mono text-xs font-semibold text-error">
              {t("passwordTooShort")}
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="font-mono text-xs font-semibold text-error" role="alert">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="focus-ring mt-2 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-sheet)] transition-all hover:-translate-y-px hover:shadow-[var(--shadow-sheet-raised)] disabled:opacity-50"
        >
          {submitting
            ? t("submitting")
            : tab === "signin"
              ? t("submitSignIn")
              : t("submitCreateAccount")}
        </button>
      </form>
    </>
  );
}
