// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { SignInModal } from "@/components/sign-in-modal";
import { ApiError, loginAuth, registerAuth } from "@/lib/api-client";
import { onSignedIn, requestSignIn } from "@/lib/auth-events";

vi.mock("@/lib/api-client", () => ({
  loginAuth: vi.fn(),
  registerAuth: vi.fn(),
  ApiError: class ApiError extends Error {
    status?: number;
    constructor(message: string, status?: number) {
      super(message);
      this.status = status;
    }
  },
}));

const mockLoginAuth = vi.mocked(loginAuth);
const mockRegisterAuth = vi.mocked(registerAuth);

const EMAIL = "learner@example.com";
const PASSWORD = "password123";

beforeEach(() => {
  mockLoginAuth.mockReset();
  mockRegisterAuth.mockReset();
});

afterEach(() => {
  cleanup();
});

function fillSignIn() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: EMAIL } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: PASSWORD } });
  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
}

describe("SignInModal", () => {
  it("stays closed until a sign-in is requested", () => {
    renderWithLocale(<SignInModal />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens in place when a sign-in is requested (no navigation)", async () => {
    renderWithLocale(<SignInModal />);
    // The API client's handleUnauthorized asks for the modal on a 401;
    // the modal opens over the current surface.
    requestSignIn();
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeTruthy();
    // …and nothing navigated: the surface behind the modal is untouched.
    expect(window.location.pathname).toBe("/");
  });

  it("shows the shared form with both tabs", async () => {
    renderWithLocale(<SignInModal />);
    requestSignIn();
    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: "Sign in", pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
  });

  it("closes in place on a successful sign-in and announces it to the surface", async () => {
    mockLoginAuth.mockResolvedValue(undefined);
    const signedIn = vi.fn();
    const unsubscribe = onSignedIn(signedIn);
    renderWithLocale(<SignInModal />);
    requestSignIn();
    await screen.findByRole("dialog");
    fillSignIn();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mockLoginAuth).toHaveBeenCalledWith(EMAIL, PASSWORD);
    // The surface is told to refetch in place; the modal did not navigate.
    expect(signedIn).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("keeps the modal open and shows the error on a failed sign-in", async () => {
    mockLoginAuth.mockRejectedValue(new ApiError("invalid", 401));
    renderWithLocale(<SignInModal />);
    requestSignIn();
    await screen.findByRole("dialog");
    fillSignIn();

    await screen.findByText("Invalid email or password.");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes when dismissed, without signing in or announcing one", async () => {
    const signedIn = vi.fn();
    const unsubscribe = onSignedIn(signedIn);
    renderWithLocale(<SignInModal />);
    requestSignIn();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mockLoginAuth).not.toHaveBeenCalled();
    // Dismissing is not a sign-in: no surface is told to refetch.
    expect(signedIn).not.toHaveBeenCalled();
    unsubscribe();
  });
});
