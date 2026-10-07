import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
