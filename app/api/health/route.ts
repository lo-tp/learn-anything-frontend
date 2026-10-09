/**
 * The health route (#158): the one URL in this app whose only job is to answer,
 * because the load balancer's HTTP health check accepts **exactly 200** — a `3xx`
 * marks the backend unhealthy and the behaviour is not configurable — while the
 * kubelet counts 3xx as passing. That gap is what turned the public surface into
 * a 502 when deleting the login page made `/en/login`, the path the readiness
 * probe was asking for, into the catch-all's redirect: every pod still reported
 * Ready, and the CI smoke step passed by asserting the redirect that was the
 * defect.
 *
 * So this route is built to have nothing in front of it or behind it: it is a
 * Route Handler, not a page, so no layout, no render, no messages; it sits
 * outside `app/[locale]`, so neither locale prefixing nor the
 * `[locale]/[...all]` redirect (which answers every unhandled path *under a
 * locale*) can claim it; `proxy.ts` excludes `/api` in its matcher, so no locale
 * redirect runs on it; and it reads nothing — no headers, cookies, auth, backend,
 * database — so there is no dependency for it to fail on.
 *
 * The path is paired with the deployment's readiness probe (learn-anything-infra,
 * `manifests/base/frontend.yaml`): either repository moving it alone reproduces
 * the outage. The guards are `test/routes/health-route.test.ts` and the image
 * smoke step in `.github/workflows/build-image.yml`.
 */
export function GET(): Response {
  return new Response("ok", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // A health answer about this moment, never a cached one.
      "Cache-Control": "no-store",
    },
  });
}
