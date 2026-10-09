// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { TopBar } from "@/components/top-bar";
import { onRequestSignIn } from "@/lib/auth-events";

const { getMe, updateMe, logoutAuth } = vi.hoisted(() => ({
  getMe: vi.fn(),
  updateMe: vi.fn(),
  logoutAuth: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  getMe,
  updateMe,
  logoutAuth,
}));

// The wordmark and the tabs use the locale-aware `Link`; the switcher and
// tabs ask for the pathname. Render links as anchors.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  usePathname: () => "/en",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const USER = { id: 1, email: "test@example.com", display_name: "Alice" };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TopBar", () => {
  it("shows a Sign in affordance for a Visitor, in place of the account menu", async () => {
    // A Visitor: the account menu cannot identify anyone and hides itself.
    getMe.mockRejectedValue(new Error("connection reset"));
    renderWithLocale(<TopBar />);

    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(1));
    // The standing way back in is visible…
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    // …and the account menu has hidden itself.
    expect(screen.queryByRole("button", { name: "Alice" })).toBeNull();
  });

  it("still shows the account menu when it can identify someone", async () => {
    getMe.mockResolvedValue(USER);
    renderWithLocale(<TopBar />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Alice" })).toBeTruthy();
    });
    // The Sign in affordance stands beside it (the app never probes who
    // you are; the button is static).
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
  });

  it("asks the sign-in modal to open when the affordance is clicked", async () => {
    getMe.mockRejectedValue(new Error("connection reset"));
    renderWithLocale(<TopBar />);
    await waitFor(() => expect(getMe).toHaveBeenCalledTimes(1));

    const ask = vi.fn();
    const unsubscribe = onRequestSignIn(ask);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    unsubscribe();
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
