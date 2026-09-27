import type { ReactNode } from "react";

/**
 * The friendly full-page state: a centered icon, title, optional subtitle
 * and note, an optional trailing chip, and an optional footer action (a
 * link home, a retry button, …). Pure leaf — the view owns the i18n strings
 * and the action element, so the same panel serves loading / not found /
 * error / not ready / generating across the views (#132).
 */
export function StatePanel({
  icon,
  title,
  note,
  subtitle,
  chip,
  action,
}: {
  icon?: ReactNode;
  title: string;
  note?: string;
  subtitle?: string;
  chip?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center overflow-y-auto">
      <div className="flex flex-col items-center gap-3 p-8 text-center">
        {icon}
        <h1 className="font-display text-2xl font-semibold text-on-surface">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-on-surface-variant">{subtitle}</p>
        )}
        {note && <p className="max-w-md text-sm text-on-surface-variant">{note}</p>}
        {chip}
        {action}
      </div>
    </main>
  );
}
