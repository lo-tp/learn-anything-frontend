// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { LanguageSwitcher } from "@/components/language-switcher";

// The navigation hooks come from `@/i18n/navigation`; we replace them with
// spies so we can assert the switch re-routes to the chosen locale.
// `vi.hoisted` keeps the spies initialized before the mock factory runs at
// import time.
const { push, pathname } = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: "/session/abc",
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
  Link: () => null,
}));

/**
 * Open the menu. The Radix trigger opens on `pointerdown` (not `click`), so
 * dispatch a left-button pointer-down on the trigger.
 */
async function openMenu() {
  fireEvent.pointerDown(
    screen.getByRole("button", { name: "Choose language" }),
    { button: 0 },
  );
  await screen.findByRole("menu");
}

afterEach(() => {
  cleanup();
  push.mockClear();
});

describe("LanguageSwitcher", () => {
  it("shows the current language on the trigger", () => {
    renderWithLocale(<LanguageSwitcher />, { locale: "en" });
    expect(
      screen.getByRole("button", { name: "Choose language" }),
    ).toBeTruthy();
    // The trigger (not a menu item) shows the current locale's label.
    expect(screen.getByText("EN")).toBeTruthy();
  });

  it("lists every locale when opened", async () => {
    renderWithLocale(<LanguageSwitcher />, { locale: "en" });
    await openMenu();
    expect(screen.getByRole("menuitem", { name: "EN" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "中文" })).toBeTruthy();
  });

  it("marks the current locale in the menu", async () => {
    renderWithLocale(<LanguageSwitcher />, { locale: "en" });
    await openMenu();
    // The check indicator is only present on the active locale's item.
    const current = screen.getByRole("menuitem", { name: "EN" });
    const other = screen.getByRole("menuitem", { name: "中文" });
    expect(current.querySelector("svg")).toBeTruthy();
    expect(other.querySelector("svg")).toBeNull();
  });

  it("navigates to the selected locale, keeping the current pathname", async () => {
    renderWithLocale(<LanguageSwitcher />, { locale: "en" });
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "中文" }));
    expect(push).toHaveBeenCalledWith(pathname, { locale: "zh" });
  });

  it("does not navigate when the current locale is selected", async () => {
    renderWithLocale(<LanguageSwitcher />, { locale: "en" });
    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "EN" }));
    expect(push).not.toHaveBeenCalled();
  });
});
