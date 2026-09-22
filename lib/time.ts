/**
 * `lib/time` — relative timestamps for the History list.
 *
 * Buckets: "just now" → "N min ago" → "Yesterday" → "N hrs ago" →
 * "Oct 24" (plus the year once it is not the current one). The bucket
 * templates come from the `time` message namespace (ICU plurals); the
 * calendar-date buckets use `Intl.DateTimeFormat` with the locale tag.
 */
import type { Locale } from "next-intl";
import { createTranslator } from "use-intl/core";

const DAY_MS = 86_400_000;

/** The `time` message namespace (see `messages/*.json`). */
export type TimeStrings = {
  justNow: string;
  minAgo: string;
  yesterday: string;
  hrsAgo: string;
};

/** The BCP-47 tag used for `Intl` date formatting. */
function localeTag(locale: string): string {
  return locale === "zh" ? "zh-CN" : "en-US";
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Human-friendly relative time for an ISO timestamp, rendered from the
 * `time` namespace templates for the given locale.
 */
export function timeAgo(
  isoTimestamp: string,
  locale: Locale,
  strings: TimeStrings,
  now: Date = new Date(),
): string {
  const t = createTranslator({ locale, messages: strings });
  const then = new Date(isoTimestamp);
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return t("justNow");
  if (minutes < 60) return t("minAgo", { n: minutes });

  const dayDiff = Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS);
  if (dayDiff === 1) return t("yesterday");
  if (dayDiff > 1) {
    const label = then.toLocaleDateString(localeTag(locale), {
      month: "short",
      day: "numeric",
    });
    return then.getFullYear() === now.getFullYear()
      ? label
      : `${label}, ${then.getFullYear()}`;
  }
  // Same calendar day, at least an hour ago (minutes >= 60 here, so
  // hours >= 1).
  const hours = Math.floor(minutes / 60);
  return t("hrsAgo", { n: hours });
}
