import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
  // The /demos route compiles the hand-inserted sample demo with esbuild
  // per request (#37). esbuild is a native package — it must be required
  // at runtime, not bundled by Turbopack.
  serverExternalPackages: ["esbuild"],
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
