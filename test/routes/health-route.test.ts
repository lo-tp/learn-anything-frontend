import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";
import { config as proxyConfig } from "@/proxy";

/**
 * The health route's contract (#158): exactly 200, and nothing answering it
 * first. Why a `3xx` is fatal is written once, in `app/api/health/route.ts`.
 *
 * This file can only prove the handler and the matchers in front of it. Whether
 * a real server — proxy, catch-all and route table included — answers
 * `GET /api/health` with 200 is asserted against the built image in the smoke
 * step of `.github/workflows/build-image.yml`.
 */

/** The path the deployment's readiness probe asks for. */
const HEALTH_PATH = "/api/health";

/**
 * A proxy matcher string as Next applies it: anchored to the whole path. Next
 * 16.3.4 compiles `proxy.ts`'s entry to
 * `^(?:\/(_next\/data\/[^/]{1,}))?(?:\/((?!api|_next\/static|…).*))(\.json|…)?$`
 * — readable in `.next/server/functions-config-manifest.json` after a build.
 * The unanchored form is the trap: `new RegExp(source).test("/api/health")`
 * finds the pattern at the **second** `/` and reports a match that never happens
 * in a running server.
 */
function toAnchoredMatcher(source: string): RegExp {
  return new RegExp(`^(?:${source})$`);
}

function proxyMatchers(): RegExp[] {
  return proxyConfig.matcher.map(toAnchoredMatcher);
}

describe("GET /api/health (the load balancer's health route)", () => {
  it("answers 200", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("is not a redirect: a 3xx is an unhealthy backend to GCE", async () => {
    const res = await GET();
    expect(res.status).toBeLessThan(300);
    expect(res.redirected).toBe(false);
    expect(res.headers.get("Location")).toBeNull();
  });

  it("answers with a trivial body, and never a cached one", async () => {
    const res = await GET();
    expect(await res.text()).toBe("ok");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets no identity of its own: no cookie, no auth challenge", async () => {
    const res = await GET();
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(res.headers.get("WWW-Authenticate")).toBeNull();
  });
});

describe("the health path is out of the locale proxy's way", () => {
  it("is not matched by any proxy matcher, so it is never locale-redirected", () => {
    for (const matcher of proxyMatchers()) {
      expect(matcher.test(HEALTH_PATH)).toBe(false);
    }
  });

  it("is excluded because of the exclusion, not an empty matcher: pages still match", () => {
    const matched = proxyMatchers().some((matcher) => matcher.test("/en/mine"));
    expect(matched).toBe(true);
  });
});
