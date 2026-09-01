/**
 * Placeholder empty state — the real design lands with the empty-state
 * ticket; this keeps `<HistoryView />` rendering something when the
 * fixture list is toggled off.
 */
export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="font-display text-xl font-medium text-on-surface">
        No sessions yet
      </p>
      <p className="mt-2 text-on-surface-variant">
        Start your first session to see it here.
      </p>
    </div>
  );
}
