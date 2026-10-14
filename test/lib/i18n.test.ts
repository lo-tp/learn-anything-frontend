import { describe, expect, it } from "vitest";
import { localeLanguage } from "@/i18n/routing";
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

describe("locale → backend language name (#205)", () => {
  // The names are what the backend stores on `Session.language` (the
  // langid code → name mapping) and what the list endpoints' `language`
  // param matches.
  it("maps each app locale to the backend's language name", () => {
    expect(localeLanguage("en")).toBe("English");
    expect(localeLanguage("zh")).toBe("Chinese");
  });

  it("falls back to the backend's default language for unknown locales", () => {
    // Only en/zh occur in the app, but the fallback mirrors how the backend
    // reads legacy rows with no stored language.
    expect(localeLanguage("fr")).toBe("English");
  });
});
