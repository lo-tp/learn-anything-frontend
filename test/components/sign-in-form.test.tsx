// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { SignInForm } from "@/components/sign-in-form";
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

let onSuccess: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  mockLoginAuth.mockReset();
  mockRegisterAuth.mockReset();
  onSuccess = vi.fn<() => void>();
});

afterEach(() => {
  cleanup();
});

/** Render the form and land on the "Create account" tab with filled-in
 *  registration fields. Returns the form so the caller can submit it. */
async function onRegisterTab() {
  renderWithLocale(<SignInForm onSuccess={onSuccess} />);
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: EMAIL } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: PASSWORD } });
  return screen.getByLabelText("Email").closest("form")!;
}

/** Fill in the Sign in tab's fields and return the form. */
function onSignInTab() {
  renderWithLocale(<SignInForm onSuccess={onSuccess} />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: EMAIL } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: PASSWORD } });
  return screen.getByLabelText("Email").closest("form")!;
}

describe("SignInForm", () => {
  it("starts on the Sign in tab", () => {
    renderWithLocale(<SignInForm onSuccess={onSuccess} />);
    expect(screen.getByRole("button", { name: "Sign in", pressed: true })).toBeTruthy();
  });

  it("signs in via loginAuth and reports success", async () => {
    mockLoginAuth.mockResolvedValue(undefined);
    const form = onSignInTab();
    fireEvent.submit(form);

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mockLoginAuth).toHaveBeenCalledWith(EMAIL, PASSWORD);
  });

  it("switches to the Sign in tab after a successful registration, retaining the email and clearing the password", async () => {
    mockRegisterAuth.mockResolvedValue({
      id: 1,
      email: EMAIL,
      display_name: "Learner",
    });
    const form = await onRegisterTab();
    fireEvent.submit(form);

    await screen.findByRole("button", { name: "Sign in", pressed: true });

    // The email carries over, the (now committed) password is cleared so the
    // user signs in with a fresh entry.
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe(EMAIL);
    expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
    // Registration does not start a session, so no success is reported.
    expect(mockLoginAuth).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows the invalid-credentials message on a 401 and stays put", async () => {
    mockLoginAuth.mockRejectedValue(new ApiError("invalid", 401));
    const form = onSignInTab();
    fireEvent.submit(form);

    await screen.findByText("Invalid email or password.");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows the generic message for non-ApiError failures", async () => {
    mockLoginAuth.mockRejectedValue(new Error("network down"));
    const form = onSignInTab();
    fireEvent.submit(form);

    await screen.findByText("Something went wrong. Please try again.");
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("ignores a submit while the form is invalid", async () => {
    renderWithLocale(<SignInForm onSuccess={onSuccess} />);
    fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
    expect(mockLoginAuth).not.toHaveBeenCalled();
    expect(mockRegisterAuth).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows the short-password hint on the Create account tab", async () => {
    renderWithLocale(<SignInForm onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "1234567" } });

    expect(screen.getByText("Password must be at least 8 characters.")).toBeTruthy();
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

  it("switches to the Sign in tab, clearing any error", async () => {
    mockRegisterAuth.mockRejectedValue(new ApiError("Email already in use.", 409));
    const form = await onRegisterTab();
    fireEvent.submit(form);
    await screen.findByText("Email already in use.");

    // The Sign in tab button is the one that was not active.
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("button", { name: "Sign in", pressed: true })).toBeTruthy();
    // Switching tabs clears the prior error and hides the register-only
    // display-name field.
    expect(screen.queryByText("Email already in use.")).toBeNull();
    expect(screen.queryByLabelText("Display name")).toBeNull();
  });

  it("records the display name entered on the Create account tab", async () => {
    mockRegisterAuth.mockResolvedValue({ id: 1, email: EMAIL, display_name: "Learner" });
    const form = await onRegisterTab();
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Learner" } });
    fireEvent.submit(form);

    await vi.waitFor(() =>
      expect(mockRegisterAuth).toHaveBeenCalledWith(EMAIL, PASSWORD, "Learner"),
    );
  });
});
