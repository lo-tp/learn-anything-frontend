// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

// The sign-in state is settled by one `GET /auth/me` probe (#143/ADR-0005);
// these tests answer that probe and watch what the state does with it.
const { getSignedInUser } = vi.hoisted(() => ({ getSignedInUser: vi.fn() }));

vi.mock("@/lib/api-client", () => ({ getSignedInUser }));

const USER = { id: 1, email: "a@b.c", display_name: "Alice" };

/**
 * The store lives in module scope, one instance per page load. These tests
 * reset the module so each case starts from `unknown`, and import the store
 * and the auth signals together so they are the same instances.
 */
async function freshStore() {
  vi.resetModules();
  return {
    store: await import("@/hooks/use-sign-in-state"),
    events: await import("@/lib/auth-events"),
  };
}

/** A consumer of the state, printing what it sees. */
function Consumer({
  store,
}: {
  store: Awaited<ReturnType<typeof freshStore>>["store"];
}) {
  const { known, signedIn, user } = store.useSignInState();
  return (
    <p>
      {signedIn ? `user:${user?.display_name}` : known ? "visitor" : "unknown"}
    </p>
  );
}

beforeEach(() => {
  getSignedInUser.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("useSignInState", () => {
  it("settles to the User the probe returned", async () => {
    getSignedInUser.mockResolvedValue(USER);
    const { store } = await freshStore();

    render(<Consumer store={store} />);

    await screen.findByText("user:Alice");
    expect(getSignedInUser).toHaveBeenCalledTimes(1);
  });

  it("settles to a Visitor when the probe answers 401 — and does not ask for sign-in", async () => {
    // A Visitor is an expected caller, not an error: the state says so
    // quietly, so no page greets one with a sign-in form they never asked
    // for (#143).
    const asked = vi.fn();
    getSignedInUser.mockResolvedValue(null);
    const { store, events } = await freshStore();
    events.onRequestSignIn(asked);

    render(<Consumer store={store} />);

    await screen.findByText("visitor");
    expect(asked).not.toHaveBeenCalled();

    // A sign-out announced while nobody is signed in changes nothing.
    act(() => {
      events.notifySignedOut();
    });
    expect(screen.getByText("visitor")).toBeTruthy();
  });

  it("is unknown on the server, so the first client render matches the HTML", async () => {
    // The server cannot know who the viewer is either, and the client's
    // first render has to match its markup — the state settles after
    // hydration, when the probe answers.
    getSignedInUser.mockResolvedValue(USER);
    const { store } = await freshStore();

    expect(renderToString(<Consumer store={store} />)).toContain("unknown");
    expect(getSignedInUser).not.toHaveBeenCalled();
  });

  it("treats a probe the backend could not answer as a Visitor", async () => {
    // The surfaces that own data all ask again through the sign-in modal when
    // they try to write, so an unknown viewer is read as unsigned: nothing is
    // written on someone's behalf (#143).
    getSignedInUser.mockRejectedValue(new Error("backend down"));
    const { store } = await freshStore();

    render(<Consumer store={store} />);

    await screen.findByText("visitor");
  });

  it("probes once however many consumers mount", async () => {
    // The top bar, the deck, and the account menu all read the same fact;
    // that is one request per page load, not one per component (#143).
    getSignedInUser.mockResolvedValue(USER);
    const { store } = await freshStore();

    render(
      <>
        <Consumer store={store} />
        <Consumer store={store} />
      </>,
    );

    await screen.findAllByText("user:Alice");
    expect(getSignedInUser).toHaveBeenCalledTimes(1);
  });

  it("follows a sign-in: the announcement re-probes and the profile appears", async () => {
    // A Visitor signs in through the modal (#147): nothing navigates, the
    // chrome and every surface flip in place.
    getSignedInUser.mockResolvedValue(null);
    const { store, events } = await freshStore();

    render(<Consumer store={store} />);
    await screen.findByText("visitor");
    expect(getSignedInUser).toHaveBeenCalledTimes(1);

    getSignedInUser.mockResolvedValue(USER);
    act(() => {
      events.notifySignedIn();
    });
    await act(async () => {});

    expect(getSignedInUser).toHaveBeenCalledTimes(2);
    await screen.findByText("user:Alice");
  });

  it("follows a sign-out without a request: the state is already known", async () => {
    getSignedInUser.mockResolvedValue(USER);
    const { store, events } = await freshStore();

    render(<Consumer store={store} />);
    await screen.findByText("user:Alice");

    act(() => {
      events.notifySignedOut();
    });

    expect(screen.getByText("visitor")).toBeTruthy();
    expect(getSignedInUser).toHaveBeenCalledTimes(1);
  });

  it("prints a profile written back by the account menu's name edit", async () => {
    getSignedInUser.mockResolvedValue(USER);
    const { store } = await freshStore();

    render(<Consumer store={store} />);
    await screen.findByText("user:Alice");

    act(() => {
      store.setSignInUser({ ...USER, display_name: "Bob" });
    });

    expect(screen.getByText("user:Bob")).toBeTruthy();
    // Printing a name is not a reason to ask the backend again.
    expect(getSignedInUser).toHaveBeenCalledTimes(1);
  });

  it("settles a mount that comes later, sharing one probe with its own consumers", async () => {
    // A surface mounted later in the same page load asks once for itself and
    // shares the answer with anything mounted alongside it.
    getSignedInUser.mockResolvedValue(USER);
    const { store } = await freshStore();

    const first = render(<Consumer store={store} />);
    await screen.findByText("user:Alice");

    first.unmount();
    render(
      <>
        <Consumer store={store} />
        <Consumer store={store} />
      </>,
    );

    expect(screen.getAllByText("user:Alice")).toHaveLength(2);
    expect(getSignedInUser).toHaveBeenCalledTimes(2);
  });
});
