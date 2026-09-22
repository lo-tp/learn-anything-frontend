import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": "",
      // next-intl's client navigation imports `next/navigation` and
      // `next/link` — CJS subpaths Node's ESM loader can't resolve in
      // vitest — so point them at jsdom-friendly stubs.
      "next/navigation": fileURLToPath(
        new URL("./test/stubs/next-navigation.ts", import.meta.url),
      ),
      "next/link": fileURLToPath(
        new URL("./test/stubs/next-link.tsx", import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      /**
       * The UT coverage floor: 90% on all four metrics for EVERY measured
       * file (per-file, not aggregate) — `npm run test:coverage` fails the
       * run while any file is below it. Glob keys can raise the bar for
       * specific paths, e.g. `'lib/api-client.ts': { lines: 95 }`.
       */
      thresholds: {
        perFile: true,
        statements: 90,
        lines: 90,
        functions: 90,
        branches: 90,
      },
    },
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    setupFiles: ["./test/setup.ts"],
    server: {
      deps: {
        // Inline next-intl so Vite transforms its `next/*` imports and the
        // aliases above apply (externalized modules are loaded natively by
        // Node, where the extensionless subpaths fail).
        inline: ["next-intl"],
      },
    },
  },
});
