"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * The primary "Start New Session" CTA, shared by the History header and the
 * empty state so the button has a single source of truth. A pressed ink
 * block: solid print ink, square-cut, with a real contact shadow — the one
 * control on the page allowed to look heavy. The page wires it to open the
 * new-session dialog (#26) and to refetch the History after an accepted
 * intake.
 */
export function StartSessionButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations("mine");
  return (
    <button
      type="button"
      onClick={onClick}
      className="group focus-ring flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground shadow-[var(--shadow-sheet)] transition-all duration-150 hover:-translate-y-px hover:shadow-[var(--shadow-sheet-raised)] active:translate-y-0 active:shadow-[var(--shadow-sheet)] md:flex-shrink-0"
    >
      <Plus className="size-5 transition-transform duration-300 group-hover:rotate-90" />
      {t("startNewSession")}
    </button>
  );
}
