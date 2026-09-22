// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { LanguageSwitcher } from "@/components/language-switcher";
import type { Locale } from "@/i18n/routing";

// The switcher falls back to the raw locale string for locales without a
// native label (the `??` fallbacks). No app locale is missing one, so
// exercise both fallbacks with a third locale: the provider (and the
// mocked routing list) carry "fr", which `nativeNames` has no entry for.
vi.mock("@/i18n/routing", () => ({
  routing: { locales: ["en", "zh", "fr"], defaultLocale: "en", localeCookie: false },
}));

function renderWithUnknownLocale() {
  return render(
    // "fr" is deliberately outside the app's Locale union — that is the
    // unknown-locale case under test.
    <NextIntlClientProvider locale={"fr" as unknown as Locale} messages={en}>
      <LanguageSwitcher />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("LanguageSwitcher (unknown locale fallback)", () => {
  it("falls back to the raw locale string for the trigger label", () => {
    renderWithUnknownLocale();
    // "fr" is not in nativeNames — the raw string is shown.
    expect(screen.getByText("fr")).toBeTruthy();
  });

  it("falls back to the raw locale string for a menu item label", async () => {
    renderWithUnknownLocale();
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Choose language" }),
      { button: 0 },
    );
    await screen.findByRole("menu");
    // The "fr" item has no native name — the raw locale renders.
    expect(screen.getByRole("menuitem", { name: "fr" })).toBeTruthy();
  });
});
