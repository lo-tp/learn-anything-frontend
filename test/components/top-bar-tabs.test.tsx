// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { TopBarTabs } from "@/components/top-bar-tabs";

// The navigation hooks come from `@/i18n/navigation`; we replace them so
// tests can drive the pathname and assert the tab links/hrefs. `vi.hoisted`
// keeps the values initialized before the mock factory runs at import time.
// The sign-in state comes from the page's shared store (#143); the tabs read
// it, so these tests set it directly instead of driving a `GET /auth/me`.
const nav = vi.hoisted(() => ({ pathname: "/" }));
const identity = vi.hoisted(() => ({
  known: true,
  signedIn: false,
  user: null as { id: number; email: string; display_name: string } | null,
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => nav.pathname,
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/hooks/use-sign-in-state", () => ({
  useSignInState: () => ({
    known: identity.known,
    signedIn: identity.signedIn,
    user: identity.user,
  }),
}));

const USER = { id: 1, email: "a@b.c", display_name: "Alice" };

beforeEach(() => {
  nav.pathname = "/";
  identity.known = true;
  identity.signedIn = false;
  identity.user = null;
});

afterEach(() => {
  cleanup();
});

describe("TopBarTabs", () => {
  it("offers a Visitor Explore and Review", () => {
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Explore" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review" })).toBeTruthy();
  });

  it("offers a signed-in User Study and Review, never Explore (#143)", () => {
    identity.signedIn = true;
    identity.user = USER;
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Study" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Review" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Explore" })).toBeNull();
  });

  it("shows Explore while the sign-in state is unsettled, and never both", () => {
    identity.known = false;
    identity.signedIn = false;
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Explore" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Study" })).toBeNull();
  });

  it("points Explore to the root, Study to /mine, and Review to /review", () => {
    identity.signedIn = true;
    identity.user = USER;
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Study" }).getAttribute("href")).toBe("/mine");
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("href")).toBe("/review");
  });

  it("points Explore to the root for a Visitor", () => {
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Explore" }).getAttribute("href")).toBe("/");
  });

  it("marks Explore active at the root for a Visitor", () => {
    nav.pathname = "/";
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Explore" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("aria-current")).toBeNull();
  });

  it("marks Study active at /mine for a signed-in User", () => {
    identity.signedIn = true;
    identity.user = USER;
    nav.pathname = "/mine";
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Study" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("aria-current")).toBeNull();
  });

  it("marks no tab active when a signed-in User is on the public feed", () => {
    identity.signedIn = true;
    identity.user = USER;
    nav.pathname = "/";
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Study" }).getAttribute("aria-current")).toBeNull();
    expect(screen.queryByRole("link", { name: "Explore" })).toBeNull();
  });

  it("marks Review active at /review", () => {
    nav.pathname = "/review";
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Explore" }).getAttribute("aria-current")).toBeNull();
  });

  it("marks Study active on a session page", () => {
    identity.signedIn = true;
    identity.user = USER;
    nav.pathname = "/session/abc";
    renderWithLocale(<TopBarTabs />);
    expect(screen.getByRole("link", { name: "Study" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Review" }).getAttribute("aria-current")).toBeNull();
  });

  it("labels the tabs from the zh catalog under the zh locale", () => {
    renderWithLocale(<TopBarTabs />, { locale: "zh" });
    expect(screen.getByRole("link", { name: "探索" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "复习" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "学习" })).toBeNull();
  });

  it("labels Study and Review from the zh catalog for a signed-in User", () => {
    identity.signedIn = true;
    identity.user = USER;
    renderWithLocale(<TopBarTabs />, { locale: "zh" });
    expect(screen.getByRole("link", { name: "学习" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "复习" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "探索" })).toBeNull();
  });
});
