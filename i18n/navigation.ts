import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation: the i18n `Link` prefixes internal hrefs with the
 * current locale (so `<Link href="/session/abc">` renders
 * `/en/session/abc` under `en`), plus `usePathname`/`useRouter` that operate
 * on locale-less pathnames.
 *
 * Kept separate from `./routing` on purpose: `next-intl/navigation`'s
 * server build drags the request config (and thus `next/root-params`) into
 * whatever bundle imports it, and `next/root-params` cannot be used in the
 * middleware layer — so the proxy must never import this module.
 */
export const { Link, usePathname, useRouter } = createNavigation(routing);
