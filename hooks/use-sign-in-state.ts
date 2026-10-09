"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getSignedInUser, type UserOut } from "@/lib/api-client";
import { onSignedIn, onSignedOut } from "@/lib/auth-events";

/**
 * The app's one client-side source of truth for the viewer's **sign-in
 * state** (#143): a signed-in User (with their profile, which the account
 * menu prints) or a Visitor (nothing).
 *
 * The cookie is `HttpOnly`, so the client cannot read it; the only identity
 * signal is the answer of `GET /auth/me` — `200` with the profile, `401`
 * without (ADR-0004). That probe runs **once per page load**, here, and
 * every consumer of the fact subscribes to the result instead of probing for
 * itself: the top bar's tabs (Explore for a Visitor, Study for a User —
 * never both, #143), the top bar's Sign-in affordance, the account menu,
 * and the Session deck that decides whether a miss is written (ADR-0005).
 *
 * A failed probe (backend unreachable, 5xx) settles as a Visitor: the
 * surfaces that need an owner all ask again through the sign-in modal when
 * they try to write, so treating an unknown viewer as unsigned is the
 * least-harmful reading — it never writes on someone's behalf, and it never
 * opens a modal nobody asked for.
 *
 * State lives in module scope (not `useState`) so every consumer sees the
 * same value, the same way `useTheme` shares the theme. The first render is
 * always `unknown` — the server cannot know either, and the client's first
 * render has to match its HTML — so consumers render the Visitor chrome
 * until the probe lands and then flip in place.
 */
export type SignInState = {
  /**
   * Whether the probe has answered. A surface that must not act before it
   * knows (a write that would belong to someone) can tell "not yet known"
   * from "a Visitor"; the chrome deliberately does not — it shows the
   * Visitor's chrome either way.
   */
  known: boolean;
  /** The signed-in User, or `null` for a Visitor. */
  user: UserOut | null;
};

const UNKNOWN: SignInState = { known: false, user: null };
const VISITOR: SignInState = { known: true, user: null };

let state: SignInState = UNKNOWN;
let inFlight: Promise<void> | null = null;
let wired = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of [...listeners]) listener();
}

function replace(next: SignInState) {
  if (next === state) return;
  state = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SignInState {
  return state;
}

/** The server snapshot: always `unknown` — the SSR chrome is the Visitor's. */
function getServerSnapshot(): SignInState {
  return UNKNOWN;
}

/** Probe once; concurrent callers share one request (`GET /auth/me`). */
function probe(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = getSignedInUser()
    .then((user) => replace(user ? { known: true, user } : VISITOR))
    .catch(() => replace(VISITOR))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Follow the auth signals once per page load: a sign-in through the modal
 * re-probes (the profile is what carries the name and the User chrome), a
 * sign-out is already known — no request needed.
 */
function wire() {
  if (wired) return;
  wired = true;
  onSignedIn(() => {
    void probe();
  });
  onSignedOut(() => replace(VISITOR));
}

/** Print a new profile in the chrome after the account menu edits a name. */
export function setSignInUser(user: UserOut): void {
  replace({ known: true, user });
}

/**
 * The viewer's sign-in state. Returns `unknown` on the first render (and on
 * the server), then the settled answer; the probe starts after mount, so the
 * client's first render matches the server HTML and the flip happens after
 * hydration.
 */
export function useSignInState(): {
  known: boolean;
  signedIn: boolean;
  user: UserOut | null;
} {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    wire();
    void probe();
  }, []);

  return {
    known: snapshot.known,
    signedIn: snapshot.user !== null,
    user: snapshot.user,
  };
}
