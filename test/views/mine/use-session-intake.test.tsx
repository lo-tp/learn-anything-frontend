// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import en from "@/messages/en.json";
import { useSessionIntake } from "@/views/mine/use-session-intake";
import { createSession } from "@/lib/api-client";

// Only the effect that `submit` fires in these tests needs a live mock; the
// rest are placeholders so the module graph resolves.
vi.mock("@/lib/api-client", () => ({
  createSession: vi.fn(),
  clarifySession: vi.fn(),
  startProbe: vi.fn(),
  answerProbe: vi.fn(),
  generatePlan: vi.fn(),
  adjustPlan: vi.fn(),
  approvePlan: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockCreateSession = vi.mocked(createSession);

function renderIntake() {
  const props = {
    open: true,
    onAccept: vi.fn(),
    onOpenChange: vi.fn(),
  };
  const { result } = renderHook(
    (p: typeof props) => useSessionIntake(p),
    {
      initialProps: props,
      wrapper: ({ children }) => (
        <NextIntlClientProvider locale="en" messages={en}>
          {children}
        </NextIntlClientProvider>
      ),
    },
  );
  return { result, props };
}

beforeEach(() => {
  mockCreateSession.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("useSessionIntake.handleOpenChange", () => {
  it("reports the open direction straight through to the parent", () => {
    const { result, props } = renderIntake();

    act(() => result.current.handleOpenChange(true));

    // The open path is a pure passthrough — no close intent fires.
    expect(props.onOpenChange).toHaveBeenCalledWith(true);
    expect(props.onAccept).not.toHaveBeenCalled();
  });

  it("closes when Radix reports close while the request is idle", () => {
    const { result, props } = renderIntake();

    act(() => result.current.handleOpenChange(false));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("refuses to close while a request is in flight", () => {
    const { result, props } = renderIntake();
    // A never-settling createSession keeps the intake in flight.
    mockCreateSession.mockReturnValue(new Promise(() => {}));
    act(() => result.current.submit("A goal."));

    act(() => result.current.handleOpenChange(false));

    // The guard returns before `close()`, so the parent is not told to close.
    expect(props.onOpenChange).not.toHaveBeenCalled();
  });
});
