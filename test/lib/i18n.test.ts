import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

/** Deep-collect a nested catalog's dot-separated leaf keys. */
function keysOf(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object"
      ? keysOf(value as Record<string, unknown>, path)
      : [path];
  });
}

describe("message catalogs", () => {
  it("en and zh expose the exact same key set", () => {
    expect(keysOf(zh).sort()).toEqual(keysOf(en).sort());
  });
});
