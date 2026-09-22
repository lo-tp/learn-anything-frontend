import { describe, expect, it } from "vitest";
import { hasLocale, localeTag, routing } from "@/i18n/routing";

describe("routing", () => {
  it("serves en and zh, defaulting to en", () => {
    expect(routing.locales).toEqual(["en", "zh"]);
    expect(routing.defaultLocale).toBe("en");
  });
});

describe("hasLocale", () => {
  it("accepts the locales in `routing.locales`", () => {
    expect(hasLocale("en")).toBe(true);
    expect(hasLocale("zh")).toBe(true);
  });

  it("rejects null, undefined, and unknown values", () => {
    expect(hasLocale(null)).toBe(false);
    expect(hasLocale(undefined)).toBe(false);
    expect(hasLocale("fr")).toBe(false);
  });
});

describe("localeTag", () => {
  it("maps zh to zh-CN", () => {
    expect(localeTag("zh")).toBe("zh-CN");
  });

  it("returns the locale itself for everything else", () => {
    expect(localeTag("en")).toBe("en");
  });
});
