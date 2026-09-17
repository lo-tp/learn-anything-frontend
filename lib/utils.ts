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
