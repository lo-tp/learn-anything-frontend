// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { AccountMenu } from "@/components/account-menu";
import { onSignedOut } from "@/lib/auth-events";

// The menu prints whoever the page's sign-in state holds (#143), and that
// state is settled by one `GET /auth/me` probe. So these tests drive the
// probe's answer through the API client and let the real state do the rest:
// who the menu shows, and when it hides itself.
const { getSignedInUser, updateMe, logoutAuth } = vi.hoisted(() => ({
  getSignedInUser: vi.fn(),
  updateMe: vi.fn(),
  logoutAuth: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  getSignedInUser,
  updateMe,
  logoutAuth,
}));

// The sign-out handler navigates, so the navigation hooks are doubled too:
// tests drive which page the menu is on and assert where it sends the person.
const nav = vi.hoisted(() => ({ pathname: "/mine", replace: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: () => null,
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace }),
}));

const USER = { id: 1, email: "test@example.com", display_name: "Alice" };

/** Wait for this test's probe to answer, so the state is settled. */
async function probeSettled() {
  await waitFor(() => expect(getSignedInUser).toHaveBeenCalledTimes(1));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  nav.pathname = "/mine";
});

describe("AccountMenu", () => {
  it("renders a circular avatar with the display name initial", async () => {
    getSignedInUser.mockResolvedValue(USER);
    renderWithLocale(<AccountMenu />);

    await probeSettled();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Alice" })).toBeTruthy();
    });
    // The avatar shows the initial "A".
    expect(screen.getByRole("button", { name: "Alice" }).textContent).toBe("A");
  });

  it("stays hidden for a Visitor — the probe answered 401, so there is no profile", async () => {
    getSignedInUser.mockResolvedValue(null);
    renderWithLocale(<AccountMenu />);

    await probeSettled();
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });

  it("stays hidden when the probe fails, instead of throwing through the shell", async () => {
    // The sign-in state treats a probe the backend could not answer as a
    // Visitor (#143): the menu hides rather than breaking the page, and no
    // write is attempted on someone we cannot identify. This pins that
    // contract, so the tolerated failure is not mistaken for an unhandled
    // rejection — and it is the branch the coverage floor measures on CI.
    getSignedInUser.mockRejectedValue(new Error("connection reset"));
    renderWithLocale(<AccountMenu />);

    await probeSettled();
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });

  it("opens a dropdown showing the display name, edit-name, and sign out", async () => {
    getSignedInUser.mockResolvedValue(USER);
    renderWithLocale(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: "Alice" });
    fireEvent.pointerDown(trigger, { button: 0 });

    await screen.findByRole("menu");
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Edit display name" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeTruthy();
  });

  it("opens the edit-name dialog from the dropdown", async () => {
    getSignedInUser.mockResolvedValue(USER);
    renderWithLocale(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: "Alice" });
    fireEvent.pointerDown(trigger, { button: 0 });

    fireEvent.click(screen.getByRole("menuitem", { name: "Edit display name" }));

    await screen.findByRole("dialog");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("saves a new display name via updateMe and reflects it in the state", async () => {
    getSignedInUser.mockResolvedValue(USER);
    updateMe.mockResolvedValue({ ...USER, display_name: "Bob" });
    renderWithLocale(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: "Alice" });
    fireEvent.pointerDown(trigger, { button: 0 });

    fireEvent.click(screen.getByRole("menuitem", { name: "Edit display name" }));

    const dialog = await screen.findByRole("dialog");
    const input = dialog.querySelector("input")!;
    fireEvent.change(input, { target: { value: "Bob" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateMe).toHaveBeenCalledWith("Bob");
    });
    // The avatar updates to the new initial: the edited profile is written
    // back into the sign-in state the whole chrome reads.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bob" })).toBeTruthy();
    });
  });

  it("shows an inline error when updateMe fails", async () => {
    getSignedInUser.mockResolvedValue(USER);
    updateMe.mockRejectedValue(new Error("boom"));
    renderWithLocale(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: "Alice" });
    fireEvent.pointerDown(trigger, { button: 0 });

    fireEvent.click(screen.getByRole("menuitem", { name: "Edit display name" }));

    const dialog = await screen.findByRole("dialog");
    const input = dialog.querySelector("input")!;
    fireEvent.change(input, { target: { value: "Bob" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Something went wrong. Please try again.");
  });

  it("does not call updateMe when the name is blank", async () => {
    getSignedInUser.mockResolvedValue(USER);
    renderWithLocale(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: "Alice" });
    fireEvent.pointerDown(trigger, { button: 0 });

    fireEvent.click(screen.getByRole("menuitem", { name: "Edit display name" }));

    const dialog = await screen.findByRole("dialog");
    const input = dialog.querySelector("input")!;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(updateMe).not.toHaveBeenCalled();
  });

  it("signs out via logoutAuth, settles the state to a Visitor's, and sends the person to Explore", async () => {
    // The surface the person was on belongs to a User, so after signing out
    // they cannot stay on it. The menu asks for the site root — the public
    // Explore list — and the announcement settles the sign-in state to a
    // Visitor's: the menu hides itself and the chrome becomes the Visitor's
    // (#143). `replace`, not `push`: the signed-in surface must not be left
    // in history behind them.
    const signedOut = vi.fn();
    const unsubscribe = onSignedOut(signedOut);
    getSignedInUser.mockResolvedValue(USER);
    logoutAuth.mockResolvedValue(undefined);
    renderWithLocale(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: "Alice" });
    fireEvent.pointerDown(trigger, { button: 0 });

    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => {
      expect(logoutAuth).toHaveBeenCalled();
    });
    // …they are taken to the site root, the Explore list…
    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("/");
    });
    // …the surface is told to re-render as a Visitor…
    await waitFor(() => {
      expect(signedOut).toHaveBeenCalledTimes(1);
    });
    // …and the avatar is gone — the state now holds no profile.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Alice" })).toBeNull();
    });
    unsubscribe();
  });

  it("does not navigate when already on Explore — the Visitor's feed is on screen", async () => {
    nav.pathname = "/";
    getSignedInUser.mockResolvedValue(USER);
    logoutAuth.mockResolvedValue(undefined);
    renderWithLocale(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: "Alice" });
    fireEvent.pointerDown(trigger, { button: 0 });

    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => {
      expect(logoutAuth).toHaveBeenCalled();
    });
    await act(async () => {});
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("keeps the menu when sign-out fails (the user stays signed in)", async () => {
    getSignedInUser.mockResolvedValue(USER);
    logoutAuth.mockRejectedValue(new Error("backend down"));
    renderWithLocale(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: "Alice" });
    fireEvent.pointerDown(trigger, { button: 0 });

    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    // The failure is silent (no toast surface, #132 gap 1); the least-
    // harmful outcome is to leave the user signed in, and no surface is told
    // the user is gone.
    const signedOut = vi.fn();
    const unsubscribe = onSignedOut(signedOut);
    await waitFor(() => {
      expect(logoutAuth).toHaveBeenCalledTimes(1);
    });
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Alice" })).toBeTruthy();
    expect(signedOut).not.toHaveBeenCalled();
    // A failed sign-out does not move the person either: they are still on
    // the page they were on, still signed in.
    expect(nav.replace).not.toHaveBeenCalled();
    unsubscribe();
  });
});
