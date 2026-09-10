/**
 * Unit test for `getDemoBySlug` while it is a no-db stub (#32).
 *
 * The stub returns random demo data for any slug; this only pins the
 * return shape the `/demos` routes will depend on. Revisit (or delete) when
 * the real lookup lands with the `demo_slug` column.
 */
import { describe, expect, it } from "vitest";
import { getDemoBySlug } from "@/core/store";

describe("getDemoBySlug (stub)", () => {
  it("returns { js, parts } for a slug", async () => {
    const demo = await getDemoBySlug("0123456789abcdef0123456789abcdef");
    expect(demo).not.toBeNull();
    expect(demo!.js).toBeTypeOf("string");
    expect(demo!.parts).toBeTypeOf("number");
    expect(demo!.parts).toBeGreaterThanOrEqual(1);
  });

  it("returns plausible random data", async () => {
    const demo = await getDemoBySlug("deadbeefdeadbeefdeadbeefdeadbeef");
    expect(demo!.js).toContain("deadbeefdeadbeefdeadbeefdeadbeef");
    expect(demo!.js).toContain("export default function Demo");
  });
});
