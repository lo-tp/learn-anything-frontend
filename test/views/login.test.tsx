// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { LoginView } from "@/views/login";
import { ApiError, loginAuth, registerAuth } from "@/lib/api-client";

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

/**
 * Render the login page, land on the "Create account" tab, and fill in the
 * registration fields. Returns the form so the caller can submit it.
 */
async function onRegisterTab() {
  renderWithLocale(<LoginView />);
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: EMAIL } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: PASSWORD } });
  return screen.getByLabelText("Email").closest("form")!;
}

describe("LoginView", () => {
  it("starts on the Sign in tab", () => {
    renderWithLocale(<LoginView />);
    expect(screen.getByRole("button", { name: "Sign in", pressed: true })).toBeTruthy();
  });

  it("switches to the Sign in tab after a successful registration, retaining the email and clearing the password", async () => {
    mockRegisterAuth.mockResolvedValue({
      id: 1,
      email: EMAIL,
      display_name: "Learner",
    });
    const form = await onRegisterTab();
    fireEvent.submit(form);

    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Sign in", pressed: true })).toBeTruthy(),
    );

    // The email carries over, the (now committed) password is cleared so the
    // user signs in with a fresh entry.
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(EMAIL);
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
    // Registration does not start a session, so no login is attempted.
    expect(mockLoginAuth).not.toHaveBeenCalled();
  });

  it("does not switch tabs when registration fails", async () => {
    mockRegisterAuth.mockRejectedValue(new ApiError("Email already in use.", 409));
    const form = await onRegisterTab();
    fireEvent.submit(form);

    // The Create account tab stays active and the error surfaces.
    await screen.findByText("Email already in use.");
    expect(screen.getByRole("button", { name: "Create account", pressed: true })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in", pressed: true })).toBeNull();
  });
});
