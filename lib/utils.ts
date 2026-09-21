import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
