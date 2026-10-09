// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { AccountMenu } from "@/components/account-menu";
import { onSignedOut } from "@/lib/auth-events";

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

vi.mock("@/i18n/navigation", () => ({
  Link: () => null,
}));

const USER = { id: 1, email: "test@example.com", display_name: "Alice" };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AccountMenu", () => {
  it("renders a circular avatar with the display name initial", async () => {
    getMe.mockResolvedValue(USER);
    renderWithLocale(<AccountMenu />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Alice" })).toBeTruthy();
    });
    // The avatar shows the initial "A".
    expect(screen.getByRole("button", { name: "Alice" }).textContent).toBe("A");
  });

  it("stays hidden when getMe fails, instead of throwing through the shell", async () => {
    // The `.catch(() => {})` in the effect is deliberate (#132 gap 5): a transient
    // /me failure leaves the menu hidden rather than breaking the page. This pins
    // that contract, so the empty catch is not mistaken for an unhandled
    // rejection — and it is the branch the coverage floor was measuring on CI.
    getMe.mockRejectedValue(new Error("connection reset"));
    renderWithLocale(<AccountMenu />);

    await waitFor(() => {
      expect(getMe).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens a dropdown showing the display name, edit-name, and sign out", async () => {
    getMe.mockResolvedValue(USER);
    renderWithLocale(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: "Alice" });
    fireEvent.pointerDown(trigger, { button: 0 });

    await screen.findByRole("menu");
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Edit display name" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeTruthy();
  });

  it("opens the edit-name dialog from the dropdown", async () => {
    getMe.mockResolvedValue(USER);
    renderWithLocale(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: "Alice" });
    fireEvent.pointerDown(trigger, { button: 0 });

    fireEvent.click(screen.getByRole("menuitem", { name: "Edit display name" }));

    await screen.findByRole("dialog");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("saves a new display name via updateMe and reflects it", async () => {
    getMe.mockResolvedValue(USER);
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
    // The avatar updates to the new initial.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bob" })).toBeTruthy();
    });
  });

  it("shows an inline error when updateMe fails", async () => {
    getMe.mockResolvedValue(USER);
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
    getMe.mockResolvedValue(USER);
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

  it("signs out via logoutAuth and stays put — the menu hides itself and the surface is told, no navigation", async () => {
    // #147: signing out leaves the person where they are. The menu hides
    // itself (the Visitor view of the top bar) and tells the current surface
    // to re-render as a Visitor; the page does not navigate to a login route
    // — the standing way back in is the top-bar Sign in.
    const signedOut = vi.fn();
    const unsubscribe = onSignedOut(signedOut);
    getMe.mockResolvedValue(USER);
    logoutAuth.mockResolvedValue(undefined);
    renderWithLocale(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: "Alice" });
    fireEvent.pointerDown(trigger, { button: 0 });

    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => {
      expect(logoutAuth).toHaveBeenCalled();
    });
    // The surface is told to re-render as a Visitor…
    await waitFor(() => {
      expect(signedOut).toHaveBeenCalledTimes(1);
    });
    // …and the avatar is gone — the menu cannot identify anyone anymore.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Alice" })).toBeNull();
    });
    unsubscribe();
  });

  it("keeps the menu when sign-out fails (the user stays signed in)", async () => {
    getMe.mockResolvedValue(USER);
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
    unsubscribe();
  });
});
