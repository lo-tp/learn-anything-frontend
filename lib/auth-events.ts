/**
 * Auth-status signals (#147).
 *
 * The sign-in modal is mounted once, in the app frame. Anything that needs it
 * opened — a 401 from an auth-gated endpoint (`handleUnauthorized`), or the
 * top-bar Sign in button — asks for it with `requestSignIn`. Successful
 * sign-ins and sign-outs are announced (`notifySignedIn` / `notifySignedOut`)
 * so the current surface can refetch in place, with no navigation: after a
 * sign-in the surface re-renders authenticated, after a sign-out it
 * re-renders as a Visitor (its next auth-gated fetch answers 401, which
 * opens the modal again — the standing way back in).
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

/** Announce that the user signed out (the surface is now a Visitor's). */
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
