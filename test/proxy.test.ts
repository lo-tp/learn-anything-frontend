import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import proxy from "@/proxy";

const ORIGIN = "http://localhost:3000";

/** Build a NextRequest with the given path and headers. */
function makeRequest(
  path: string,
  extraHeaders: Record<string, string> = {},
): NextRequest {
  return new NextRequest(`${ORIGIN}${path}`, {
    headers: extraHeaders,
  });
}

describe("proxy (locale routing)", () => {
  // --- Locale resolution from path prefix ---

  it("passes through when the path already has a valid locale prefix", async () => {
    const req = makeRequest("/en/sessions");
    const res = proxy(req);
    // A locale-prefixed path is not redirected.
    const location = res.headers.get("Location") ?? "";
    expect(location).toBe("");
  });

  it("passes through the zh locale prefix", async () => {
    const req = makeRequest("/zh/sessions");
    const res = proxy(req);
    const location = res.headers.get("Location") ?? "";
    expect(location).toBe("");
  });

  // --- Locale resolution from Accept-Language ---

  it("redirects a locale-less path to en when Accept-Language is absent", () => {
    const req = makeRequest("/sessions");
    const res = proxy(req);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/en/sessions`);
  });

  it("redirects a locale-less path to zh when Accept-Language is zh", () => {
    const req = makeRequest("/sessions", { "accept-language": "zh-CN,zh;q=0.9" });
    const res = proxy(req);
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/zh/sessions`);
  });

  it("ignores unknown 2-letter prefixes and falls back to the header", () => {
    const req = makeRequest("/ff/sessions", { "accept-language": "zh" });
    const res = proxy(req);
    // "/ff" matches the prefix shape but is not a locale — the header wins.
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/zh/ff/sessions`);
  });

  // --- Root and personal list are open (no auth gate, #149) ---

  it("does not gate the bare locale path — the page's temporary redirect to /mine handles it", () => {
    const req = makeRequest("/en");
    const res = proxy(req);
    // Pass-through: no redirect from the middleware itself. The root page
    // itself 307s to /mine.
    const location = res.headers.get("Location") ?? "";
    expect(location).toBe("");
  });

  it("does not gate the personal list (locale-prefixed)", () => {
    const req = makeRequest("/en/mine");
    const res = proxy(req);
    const location = res.headers.get("Location") ?? "";
    expect(location).toBe("");
  });

  it("does not gate the personal list (locale-less) — locale routing only", () => {
    const req = makeRequest("/mine");
    const res = proxy(req);
    // The intl middleware adds the locale prefix.
    expect(res.headers.get("Location")).toBe(`${ORIGIN}/en/mine`);
  });

  it("does not gate the review route — the page opens the sign-in modal for a Visitor", () => {
    const req = makeRequest("/en/review");
    const res = proxy(req);
    const location = res.headers.get("Location") ?? "";
    expect(location).toBe("");
  });
});
