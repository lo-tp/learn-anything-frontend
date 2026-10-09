// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { TopBarTabs } from "@/components/top-bar-tabs";

// The navigation hooks come from `@/i18n/navigation`; we replace them so
// tests can drive the pathname and assert the tab links/hrefs. `vi.hoisted`
// keeps `pathname` initialized before the mock factory runs at import time.
const nav = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => nav.pathname,
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
});

describe("TopBarTabs", () => {
  it("renders the Study and Review tabs", () => {
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Study" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review" })).toBeTruthy();
  });

  it("points Study to /mine and Review to /review", () => {
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Study" }).getAttribute("href")).toBe("/mine");
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe("/review");
  });

  it("marks Study active at /mine", () => {
    nav.pathname = "/mine";
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Study" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("aria-current")).toBeNull();
  });

  it("marks Review active at /review", () => {
    nav.pathname = "/review";
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Study" }).getAttribute("aria-current")).toBeNull();
  });

  it("marks Study active on a session page", () => {
    nav.pathname = "/session/abc";
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Study" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("aria-current")).toBeNull();
  });

  it("labels the tabs from the zh catalog under the zh locale", () => {
    renderWithLocale(<TopBarTabs />, { locale: "zh" });
    expect(screen.getByRole("link", { name: "学习" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "复习" })).toBeTruthy();
  });
});
