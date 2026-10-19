import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/**
 * Origins allowed to drive the dev server, read from `DEV_ALLOWED_ORIGINS`.
 *
 * `next dev` serves on `0.0.0.0`, so a phone on the home network can open the
 * page at `http://<lan-ip>:3000` — but Next refuses *cross-origin* requests for
 * dev-only resources (`/_next/hmr`, HMR payloads) unless the requesting origin is
 * listed in `allowedDevOrigins`. Refused, the client never finishes booting: no
 * hydration, so no `useEffect`, so a view like `views/explore.tsx` never makes the
 * fetch it owns and the browser shows the server-rendered loading panel and
 * nothing else. Nothing is thrown and nothing is logged in the page, which is why
 * the symptom reads as “the page shows nothing” rather than as a failure, and why
 * the dev server's one-line warning is the only trace of it.
 *
 * The value is a machine-local fact, so it comes from the environment like every
 * other one in this project — the same shape the backend uses for its own origin
 * policy (`CORS_ORIGINS`, read by `core.settings.origin_list_setting`). Writing an
 * address into this tracked file would commit one laptop's network to the repo.
 * Unset is an empty list, which is Next's own default: only the host the server
 * was started with may drive it.
 *
 * Two traps this reader exists to keep out. Next matches a *literal* host, so its
 * `*` wildcard is for subdomains and `192.168.*` does not match `192.168.31.178`
 * — such a setting refuses exactly as if it were absent. And an origin carries no
 * scheme or port here: write `192.168.31.178`, not `http://192.168.31.178:3000`.
 */
function devAllowedOrigins(): string[] {
  return (process.env.DEV_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const nextConfig: NextConfig = {
  /**
   * `standalone`: the Dockerfile's runtime stage copies a traced server
   * (`.next/standalone/server.js`) instead of installing `node_modules` again and
   * running `next start`. It is a build-output option, not a runtime one, so it
   * belongs in this file rather than in the image: if it is ever removed, the image
   * stops working, and the Dockerfile says why it is looking for those paths.
   *
   * One thing it does *not* trace is `messages/*.json`, because i18n/request.ts
   * imports them through a runtime-computed specifier. The Dockerfile copies that
   * directory explicitly; the two facts are each other's reason.
   */
  output: "standalone",

  /** Dev-only, machine-local, comma-separated: see `devAllowedOrigins` above. */
  allowedDevOrigins: devAllowedOrigins(),
};

// Typed messages: `createMessagesDeclaration` generates
// `messages/en.d.json.ts` (gitignored) on dev/build/typegen so that
// `t('key', {vars})` calls are compile-checked against the en catalog —
// keys, ICU placeholders, and argument names (see `types/global.ts`).
const withNextIntl = createNextIntlPlugin({
  experimental: {
    createMessagesDeclaration: "./messages/en.json",
  },
});

export default withNextIntl(nextConfig);
