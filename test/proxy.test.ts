import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

const SECRET = "test-jwt-secret";
const COOKIE_NAME = "access_token";
const ORIGIN = "http://localhost:3000";

/** Create a valid HS256 JWT signed with the test secret. */
async function makeToken(sub = "test@example.com", expOffsetSec = 86400): Promise<string> {
  const encoder = new TextEncoder();
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + expOffsetSec)
    .sign(encoder.encode(SECRET));
}

/** Build a NextRequest with the given path and optional cookie. */
function makeRequest(path: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers["cookie"] = `${COOKIE_NAME}=${cookie}`;
  }
  return new NextRequest(`${ORIGIN}${path}`, { headers });
}

describe("proxy (sign-in gate)", () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = SECRET;
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalSecret;
    }
  });

  // --- No / invalid cookie → redirect to login ---

  it("redirects to login when no cookie is present (locale-prefixed path)", async () => {
    const req = makeRequest("/en/sessions");
    const res = await proxy(req);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/en/login?next=${encodeURIComponent("/en/sessions")}`);
  });

  it("redirects to login when no cookie is present (locale-less path)", async () => {
    const req = makeRequest("/sessions");
    const res = await proxy(req);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/en/login?next=${encodeURIComponent("/sessions")}`);
  });

  it("redirects to login when cookie is present but invalid", async () => {
    const req = makeRequest("/en/sessions", "not-a-valid-jwt");
    const res = await proxy(req);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/en/login?next=${encodeURIComponent("/en/sessions")}`);
  });

  it("redirects to login when cookie is signed with the wrong secret", async () => {
    const encoder = new TextEncoder();
    const now = Math.floor(Date.now() / 1000);
    const badToken = await new SignJWT({ sub: "test@example.com" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(now)
      .setExpirationTime(now + 86400)
      .sign(encoder.encode("wrong-secret"));
    const req = makeRequest("/en/sessions", badToken);
    const res = await proxy(req);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/en/login?next=${encodeURIComponent("/en/sessions")}`);
  });

  it("redirects to login when the cookie is expired", async () => {
    const expiredToken = await makeToken("test@example.com", -3600);
    const req = makeRequest("/en/sessions", expiredToken);
    const res = await proxy(req);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/en/login?next=${encodeURIComponent("/en/sessions")}`);
  });

  // --- Valid cookie → pass-through ---

  it("passes through when a valid cookie is present (locale-prefixed path)", async () => {
    const token = await makeToken();
    const req = makeRequest("/en/sessions", token);
    const res = await proxy(req);
    // A pass-through from next-intl for an already-locale-prefixed path
    // does NOT redirect to login.
    const location = res.headers.get("Location");
    expect(location ?? "").not.toContain("/login");
  });

  it("passes through when a valid cookie is present (locale-less path)", async () => {
    const token = await makeToken();
    const req = makeRequest("/sessions", token);
    const res = await proxy(req);
    // Should be redirected to the locale-prefixed URL (by intl middleware),
    // NOT to the login page.
    const location = res.headers.get("Location");
    expect(location).toBe(`${ORIGIN}/en/sessions`);
  });

  // --- Login route is never gated ---

  it("does not redirect the login route to itself (locale-prefixed)", async () => {
    const req = makeRequest("/en/login");
    const res = await proxy(req);
    // The intl middleware passes locale-prefixed paths through.
    // It should NOT be a redirect to login with a next param.
    const location = res.headers.get("Location") ?? "";
    expect(location).not.toContain("next=");
  });

  it("does not redirect the login route to itself (locale-less)", async () => {
    const req = makeRequest("/login");
    const res = await proxy(req);
    // The intl middleware redirects to the locale-prefixed path (/en/login),
    // which is locale routing, NOT an auth redirect.
    const location = res.headers.get("Location") ?? "";
    expect(location).not.toContain("next=");
  });
});
