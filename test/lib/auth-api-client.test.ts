import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestSignIn } from "@/lib/auth-events";

const BACKEND = "http://backend.test";
process.env.NEXT_PUBLIC_BACKEND_URL = BACKEND;
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const {
  registerAuth,
  loginAuth,
  getMe,
  updateMe,
  logoutAuth,
  handleUnauthorized,
  ApiError,
} = await import("@/lib/api-client");

afterEach(() => {
  fetchMock.mockReset();
  vi.restoreAllMocks();
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const USER = { id: 1, email: "test@example.com", display_name: "Test" };

describe("registerAuth", () => {
  it("sends email, password, and display_name to POST /auth/register with credentials", async () => {
    fetchMock.mockResolvedValue(json(USER, 201));
    const result = await registerAuth("test@example.com", "password123", "Test");
    const url = new URL(fetchMock.mock.calls[0][0].url);
    expect(url.origin + url.pathname).toBe(`${BACKEND}/auth/register`);
    expect(result).toEqual(USER);
  });

  it("sends display_name as null when not provided", async () => {
    fetchMock.mockResolvedValue(json(USER, 201));
    await registerAuth("test@example.com", "password123");
    const req = fetchMock.mock.calls[0][0] as Request;
    const body = JSON.parse(await req.clone().text());
    expect(body.display_name).toBeNull();
  });

  it("throws an ApiError on 409 (email already in use)", async () => {
    fetchMock.mockResolvedValue(
      json({ detail: [{ msg: "Email already in use" }] }, 409),
    );
    const err = await registerAuth("test@example.com", "password123").catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
  });
});

describe("loginAuth", () => {
  it("sends email and password to POST /auth/login with credentials", async () => {
    fetchMock.mockResolvedValue(json({ message: "ok" }));
    await loginAuth("test@example.com", "password123");
    const url = new URL(fetchMock.mock.calls[0][0].url);
    expect(url.origin + url.pathname).toBe(`${BACKEND}/auth/login`);
  });

  it("throws an ApiError on 401 (invalid credentials)", async () => {
    fetchMock.mockResolvedValue(
      json({ detail: "Invalid credentials" }, 401),
    );
    const err = await loginAuth("test@example.com", "wrong").catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
  });
});

describe("getMe", () => {
  it("sends GET /auth/me with credentials and returns UserOut", async () => {
    fetchMock.mockResolvedValue(json(USER));
    const result = await getMe();
    const url = new URL(fetchMock.mock.calls[0][0].url);
    expect(url.origin + url.pathname).toBe(`${BACKEND}/auth/me`);
    expect(result).toEqual(USER);
  });

  it("throws an ApiError with the status on 401", async () => {
    fetchMock.mockResolvedValue(json({ detail: "Not authenticated" }, 401));
    const err = await getMe().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
  });
});

describe("updateMe", () => {
  it("sends PATCH /auth/me with display_name and returns UserOut", async () => {
    fetchMock.mockResolvedValue(json({ ...USER, display_name: "New" }));
    const result = await updateMe("New");
    const req = fetchMock.mock.calls[0][0] as Request;
    const body = JSON.parse(await req.clone().text());
    expect(body.display_name).toBe("New");
    expect(result.display_name).toBe("New");
  });
});

describe("logoutAuth", () => {
  it("sends POST /auth/logout with credentials", async () => {
    fetchMock.mockResolvedValue(json({ message: "ok" }));
    await logoutAuth();
    const url = new URL(fetchMock.mock.calls[0][0].url);
    expect(url.origin + url.pathname).toBe(`${BACKEND}/auth/logout`);
  });
});

describe("handleUnauthorized", () => {
  // The full-page redirect to /login is gone (#147): a 401 asks the sign-in
  // modal to open over the current surface, without navigating.
  it("asks the sign-in modal to open, without navigating", () => {
    const ask = vi.fn();
    const unsubscribe = onRequestSignIn(ask);
    handleUnauthorized();
    unsubscribe();
    expect(ask).toHaveBeenCalledTimes(1);
  });

  it("is a no-op when no one is listening (e.g. server side)", () => {
    expect(() => handleUnauthorized()).not.toThrow();
  });
});
