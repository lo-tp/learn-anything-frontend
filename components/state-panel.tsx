import type { ReactNode } from "react";

/**
 * The friendly full-page state: the icon set inside a stamp frame (a
 * double-ruled square, pressed at a slight rotation), the title, an optional
 * subtitle and note, an optional trailing chip, and an optional footer
 * action (a link home, a retry button, …). Pure leaf — the view owns the
 * i18n strings and the action element, so the same panel serves loading /
 * not found / error / not ready / generating across the views (#132).
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
      <div className="flex flex-col items-center gap-4 p-8 text-center">
        {icon ? (
          <span
            aria-hidden
            className="animate-stamp-press flex size-16 items-center justify-center rounded-[4px] border-[1.5px] border-outline shadow-[0_0_0_3px_var(--surface),0_0_0_4px_var(--outline-variant)]"
          >
            {icon}
          </span>
        ) : null}
        <h1 className="max-w-md font-display text-2xl font-bold text-on-surface">
          {title}
        </h1>
        {subtitle && (
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-on-surface-variant">
            {subtitle}
          </p>
        )}
        {note && (
          <p className="max-w-md text-sm leading-relaxed text-on-surface-variant">{note}</p>
        )}
        {chip}
        {action}
      </div>
    </main>
  );
}
