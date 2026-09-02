import { Plus } from "lucide-react";

/**
 * The primary "Start New Session" CTA, shared by the History header and the
 * empty state so the button has a single source of truth. The page wires it
 * to open the new-session dialog (#26) and to refetch the History after an
 * accepted intake.
 */
export function StartSessionButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-on-primary-container transition-all duration-200 shadow-[0_0_15px_rgba(192,193,255,0.2)] hover:bg-primary-fixed hover:shadow-[0_0_25px_rgba(192,193,255,0.4)] active:scale-95 md:flex-shrink-0"
    >
      <Plus className="size-5 transition-transform duration-300 group-hover:rotate-90" />
      Start New Session
    </button>
  );
}
