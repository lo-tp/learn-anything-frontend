import { describe, expect, it } from "vitest";
import { shuffleIndices } from "@/lib/utils";

/** A deterministic RNG cycling a fixed sequence of values in [0, 1). */
function seededRandom(sequence: number[]): () => number {
  let i = 0;
  return () => sequence[i++ % sequence.length];
}

describe("shuffleIndices", () => {
  it("returns the identity for 0 and 1 items", () => {
    expect(shuffleIndices(0)).toEqual([]);
    expect(shuffleIndices(1)).toEqual([0]);
  });

  it("always returns a permutation of 0..count-1", () => {
    const rng = seededRandom([
      0.1, 0.9, 0.4, 0.7, 0.2, 0.5, 0.8, 0.3, 0.6, 0.15,
    ]);
    for (const count of [2, 4, 8, 25]) {
      const shuffled = shuffleIndices(count, rng);
      expect([...shuffled].sort((a, b) => a - b)).toEqual(
        Array.from({ length: count }, (_, i) => i),
      );
    }
  });

  it("is deterministic for a given random source", () => {
    // Fisher–Yates over [0,1,2,3] with draws 0.5, 0.1, 0.9:
    // i=3 → j=floor(0.5*4)=2 → [0,1,3,2];
    // i=2 → j=floor(0.1*3)=0 → [3,1,0,2];
    // i=1 → j=floor(0.9*2)=1 → [3,1,0,2].
    const expected = [3, 1, 0, 2];
    expect(shuffleIndices(4, seededRandom([0.5, 0.1, 0.9]))).toEqual(expected);
    expect(shuffleIndices(4, seededRandom([0.5, 0.1, 0.9]))).toEqual(expected);
  });

  it("differs across draws for a varying random source", () => {
    const rng = seededRandom([
      0.1, 0.9, 0.4, 0.7, 0.2, 0.5, 0.8, 0.3, 0.6, 0.15,
    ]);
    const orders = new Set(
      Array.from({ length: 30 }, () => shuffleIndices(4, rng).join(",")),
    );
    // A fixed shuffle would produce a single order; the seeded draws
    // (deterministic) spread over several.
    expect(orders.size).toBeGreaterThan(1);
  });
});
