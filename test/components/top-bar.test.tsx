// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { TopBar } from "@/components/top-bar";
import { onRequestSignIn } from "@/lib/auth-events";

// The identity half of the bar reads the page's shared sign-in state (#143);
// these tests set that state directly. The account menu renders from the
// same state, so `user` alone decides whether the avatar is there.
const identity = vi.hoisted(() => ({
  known: true,
  signedIn: false,
  user: null as { id: number; email: string; display_name: string } | null,
}));

vi.mock("@/hooks/use-sign-in-state", () => ({
  useSignInState: () => ({
    known: identity.known,
    signedIn: identity.signedIn,
    user: identity.user,
  }),
  setSignInUser: vi.fn(),
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

beforeEach(() => {
  identity.known = true;
  identity.signedIn = false;
  identity.user = null;
});

afterEach(() => {
  cleanup();
});

describe("TopBar", () => {
  it("shows a Sign in affordance and no account menu for a Visitor", () => {
    renderWithLocale(<TopBar />);
    // The way back in is visible…
    expect(screen.getByRole("button", { name: "Sign in" })).toBeTruthy();
    // …and there is no account menu for someone with no profile.
    expect(screen.queryByRole("button", { name: "Alice" })).toBeNull();
  });

  it("shows the account menu and no Sign in affordance for a signed-in User (#143)", () => {
    identity.signedIn = true;
    identity.user = USER;
    renderWithLocale(<TopBar />);
    expect(screen.getByRole("button", { name: "Alice" })).toBeTruthy();
    // Nobody already signed in is asked to sign in again.
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("asks the sign-in modal to open when the affordance is clicked", () => {
    renderWithLocale(<TopBar />);

    const ask = vi.fn();
    const unsubscribe = onRequestSignIn(ask);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    unsubscribe();
    expect(ask).toHaveBeenCalledTimes(1);
  });
});
