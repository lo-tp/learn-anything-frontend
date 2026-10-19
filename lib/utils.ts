import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Theme } from "@/hooks/use-theme"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The sandbox URL that serves a slide item's content.
 *
 * The app's theme is passed as a query param so the slide page renders in the
 * same palette (`?theme=light` sets the `light` class on the page's `<html>`
 * for its *initial* paint, #78).
 *
 * `fresh` is the other, rarer, reason this URL changes (#213): a regenerated
 * slide keeps its ID, and a browser re-importing `/slides/{id}/bundle.js` at a
 * URL it has already fetched gets the module map's copy — the old bytes. The
 * rewritten slide reaches its reader only at a URL they have not fetched yet.
 * Shared by the deck's player frame and the sidebar's mini previews, which are
 * separate documents and must each be re-keyed on their own.
 */
export function sandboxSlideSrc(
  slideId: string,
  theme: Theme,
  fresh = 0,
): string {
  return `${process.env.NEXT_PUBLIC_SANDBOX_ORIGIN}/slides/${slideId}?theme=${theme}${
    fresh > 0 ? `&fresh=${fresh}` : ""
  }`;
}

/**
 * The inquiry identity ink (Colour Press): a deterministic spot color per
 * session — History cards, session sidebars, and their sheets carry it so
 * the record reads as a color-coded map of what you are curious about.
 * The fan deliberately excludes the correction pink and verified green:
 * an identity is never a verdict.
 */
const INQ_TOKENS = ["inq-blue", "inq-flame", "inq-violet", "inq-ochre"] as const

export function inquiryInk(id: string): (typeof INQ_TOKENS)[number] {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return INQ_TOKENS[h % INQ_TOKENS.length]
}

/**
 * A Fisher–Yates permutation of `0..count-1`. The `random` source is
 * injectable so tests can drive a deterministic shuffle; it defaults to
 * `Math.random`.
 */
export function shuffleIndices(
  count: number,
  random: () => number = Math.random,
): number[] {
  const indices = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
}

/**
 * The letter badge shown next to a lettered option (A, B, C, …).
 */
export function optionLetter(index: number): string {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

/**
 * The page number, zero-padded to at least two digits — like a form page
 * number. The footer's slide counter and the go-to dialog's page grid both
 * print the deck's pages in this voice (#229).
 */
export function padPage(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * A display order for one question: a permutation of 0..n-1.
 * When `pinLast` is true the last index is kept fixed at the end
 * (the probe's "I don't know" option); all other options are shuffled.
 */
export function displayOrder(
  n: number,
  pinLast = false,
  random: () => number = Math.random,
): number[] {
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);
  return pinLast
    ? [...shuffleIndices(n - 1, random), n - 1]
    : shuffleIndices(n, random);
}
