"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * The empty History state, per `design/home/empty_state`: a subtle primary
 * glow, a double-ring medallion holding a Sparkles icon, the "No sessions
 * yet" heading, the design's body copy, and — at the bottom — the caller's CTA
 * (`children`), which is the shared primary button supplied by the page.
 */
export function EmptyState({ children }: { children?: React.ReactNode }) {
  const t = useTranslations("home");
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden py-24 text-center">
      {/* Subtle primary glow behind the content */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]"
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        {/* Double-ring icon medallion */}
        <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rotate-3 rounded-full border border-outline-variant bg-surface-container-high shadow-[0_4px_20px_rgba(0,0,0,0.4)]" />
          <div className="absolute inset-0 -rotate-6 rounded-full border border-outline-variant/50 bg-surface-container-highest" />
          <Sparkles className="relative z-10 size-12 text-primary" strokeWidth={1.5} />
        </div>

        <h2 className="mb-4 font-display text-3xl font-semibold tracking-tight text-on-surface">
          {t("emptyTitle")}
        </h2>
        <p className="mx-auto max-w-[360px] text-lg leading-relaxed text-on-surface-variant">
          {t("emptyBody")}
        </p>

        {children ? <div className="mt-10">{children}</div> : null}
      </div>
    </div>
  );
}
