/**
 * Auth-status signals (#147).
 *
 * The sign-in modal is mounted once, in the app frame. Anything that needs it
 * opened — a 401 from an auth-gated endpoint (`handleUnauthorized`), or the
 * top-bar Sign in button — asks for it with `requestSignIn`. A successful
 * sign-in is announced (`notifySignedIn`) so the current surface can refetch
 * in place, with no navigation: it re-renders authenticated.
 *
 * A sign-out (`notifySignedOut`) settles the sign-in state to a Visitor's, so
 * the chrome is a Visitor's wherever the person ends up; the account menu
 * pairs it with a navigation to the public Explore list at the site root,
 * because the page they were on belongs to a User and cannot keep rendering
 * without one.
 *
 * A plain event bus (not React state): the API client, the top bar, and the
 * account menu live outside the modal's component tree, so they reach it
 * through these signals.
 */

type Listener = () => void;

const signInRequested = new Set<Listener>();
const signedIn = new Set<Listener>();
const signedOut = new Set<Listener>();

/** Ask the sign-in modal to open over the current surface. */
export function requestSignIn(): void {
  for (const listener of [...signInRequested]) listener();
}

/** Subscribe to sign-in requests. Returns the unsubscribe. */
export function onRequestSignIn(listener: Listener): () => void {
  signInRequested.add(listener);
  return () => {
    signInRequested.delete(listener);
  };
}

/** Announce that a sign-in succeeded through the modal. */
export function notifySignedIn(): void {
  for (const listener of [...signedIn]) listener();
}

/** Subscribe to successful sign-ins. Returns the unsubscribe. */
export function onSignedIn(listener: Listener): () => void {
  signedIn.add(listener);
  return () => {
    signedIn.delete(listener);
  };
}

/** Announce that the user signed out (the sign-in state is a Visitor's). */
export function notifySignedOut(): void {
  for (const listener of [...signedOut]) listener();
}

/** Subscribe to sign-outs. Returns the unsubscribe. */
export function onSignedOut(listener: Listener): () => void {
  signedOut.add(listener);
  return () => {
    signedOut.delete(listener);
  };
}
