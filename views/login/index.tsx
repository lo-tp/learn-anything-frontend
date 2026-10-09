"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { SignInForm } from "@/components/sign-in-form";

/**
 * The login page: a bare surface (no top bar) carrying the shared sign-in
 * form in the registration-sheet chrome. On a successful sign-in it
 * redirects to the `next` query param if present, else to the personal
 * list at `/mine` (#148).
 *
 * The form itself lives in `components/sign-in-form.tsx`, shared with the
 * sign-in modal (#147); this view owns only the chrome and the success
 * navigation. The view is a client component — the form owns its state and
 * auth fetches in the browser (#87).
 */
export function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");

  /** Navigate to `next` if provided, else to the personal list at /mine. */
  function onSuccess() {
    router.replace(next ?? "/mine", { scroll: false });
  }

  return (
    <main className="relative flex h-full items-center justify-center p-6">
      <div className="relative z-10 w-full max-w-md">
        {/* The registration sheet: a paper card whose masthead carries the
            wordmark, closed with the printed double rule. */}
        <div className="overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-[var(--shadow-sheet)]">
          <div className="relative px-8 pt-8 pb-5 double-rule-b">
            <Link
              href="/"
              className="focus-ring inline-block rounded-sm font-display text-lg font-bold uppercase tracking-[0.12em] text-primary"
            >
              Learn Anything
            </Link>
            {/* The press's own dot screen, printed beside the wordmark. */}
            <span
              aria-hidden
              className="halftone absolute top-7 right-7 size-10 text-engage opacity-25"
            />
          </div>

          <div className="p-8 pt-6">
            <SignInForm onSuccess={onSuccess} />
          </div>
        </div>
      </div>
    </main>
  );
}
