import { jwtVerify } from "jose";

/**
 * Verify a sign-in JWT (HS256) against the shared secret.
 *
 * Returns `true` only when the token is a structurally valid JWT, was
 * signed with the given secret, and its `exp` claim (if present) is not
 * in the past. Any other outcome — malformed, wrong signature, expired —
 * returns `false` without throwing.
 */
export async function verifySignInToken(
  token: string,
  secret: string,
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    await jwtVerify(token, encoder.encode(secret), { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}
