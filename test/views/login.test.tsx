// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { renderWithLocale } from "@/test/test-utils";
import { LoginView } from "@/views/login";
import { loginAuth, registerAuth } from "@/lib/api-client";

// The form's own behavior (tabs, validation, error mapping) is tested at
// `components/sign-in-form.tsx`; this file pins what the LOGIN PAGE adds:
// the success navigation to `next` (or the personal list at /mine).
const { replaceMock, searchParamsRef } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
  useSearchParams: () => searchParamsRef.current,
}));

// The wordmark link uses the locale-aware `Link`; render it as a plain
// anchor so the test can see it.
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

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
  replaceMock.mockReset();
  searchParamsRef.current = new URLSearchParams();
});

afterEach(() => {
  cleanup();
});

function submitSignIn() {
  renderWithLocale(<LoginView />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: EMAIL } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: PASSWORD } });
  fireEvent.submit(screen.getByLabelText("Email").closest("form")!);
}

describe("LoginView (the login page)", () => {
  it("carries the sign-in form in the registration sheet", () => {
    renderWithLocale(<LoginView />);
    expect(screen.getByRole("button", { name: "Sign in", pressed: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
  });

  it("signs in and navigates to the `next` param when present", async () => {
    searchParamsRef.current = new URLSearchParams({ next: "/en/sessions" });
    mockLoginAuth.mockResolvedValue();
    submitSignIn();

    await vi.waitFor(() => expect(mockLoginAuth).toHaveBeenCalledWith(EMAIL, PASSWORD));
    expect(replaceMock).toHaveBeenCalledWith("/en/sessions", { scroll: false });
  });

  it("signs in and navigates to the personal list without a `next` param", async () => {
    mockLoginAuth.mockResolvedValue();
    submitSignIn();

    await vi.waitFor(() => expect(mockLoginAuth).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith("/mine", { scroll: false });
  });
});
