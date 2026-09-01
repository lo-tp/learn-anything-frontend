/**
 * `lib/time` — relative timestamps for the History list.
 *
 * Buckets: "just now" → "N min ago" → "Yesterday" → "N hrs ago" →
 * "Oct 24" (plus the year once it is not the current one).
 */
const DAY_MS = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Human-friendly relative time for an ISO timestamp. */
export function timeAgo(isoTimestamp: string, now: Date = new Date()): string {
  const then = new Date(isoTimestamp);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;

  const dayDiff = Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS);
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff > 1) {
    const label = then.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return then.getFullYear() === now.getFullYear()
      ? label
      : `${label}, ${then.getFullYear()}`;
  }
  // Same calendar day, at least an hour ago.
  const hours = Math.floor(minutes / 60);
  return hours >= 1 ? `${hours} hrs ago` : "just now";
}
