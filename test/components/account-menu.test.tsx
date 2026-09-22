// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { AccountMenu } from "@/components/account-menu";

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

const push = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
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

  it("signs out via logoutAuth and navigates to login", async () => {
    getMe.mockResolvedValue(USER);
    logoutAuth.mockResolvedValue(undefined);
    renderWithLocale(<AccountMenu />);

    const trigger = await screen.findByRole("button", { name: "Alice" });
    fireEvent.pointerDown(trigger, { button: 0 });

    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await waitFor(() => {
      expect(logoutAuth).toHaveBeenCalled();
    });
    expect(push).toHaveBeenCalledWith("/login");
  });
});
