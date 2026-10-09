"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Bubble } from "@/components/bubble";
import { useSignInState } from "@/hooks/use-sign-in-state";
import { cn } from "@/lib/utils";

/**
 * The top-bar navigation tabs (per design/topbar).
 *
 * Two tabs at a time: the browsing tab and Review. **Explore and Study are
 * never offered together (#143)** — the chrome advertises Explore (the public
 * feed at the site root, #150) to a Visitor and Study (the personal list at
 * `/mine`, #148) to a signed-in User: one is the surface a Visitor uses, the
 * other is data the viewer owns. Review is always offered: a Visitor taps it
 * and the `401` asks them to sign in (#147).
 *
 * Which pair to show is the viewer's sign-in state, held once for the page
 * (`useSignInState`, ADR-0005). Until its probe answers — and if the probe
 * fails — the Visitor pair is shown: it is the pair that is never wrong
 * about owning data. The other half stays reachable: Explore stays at the
 * site root and the wordmark, Study stays at `/mine` for a signed-in User.
 *
 * The active tab is derived from the current pathname, so it stays in sync
 * with the route. The session detail pages belong to whichever browsing tab
 * the viewer is shown: Study owns them for a signed-in User, Explore owns
 * them for a Visitor (the pair is mutually exclusive, so only one can claim
 * a session). Labels come from the `topbar` namespace. Always visible —
 * Review must stay reachable on small screens — so the tabs shrink below
 * `md` (the wordmark steps aside there).
 */

type Tab = {
  key: "explore" | "study" | "review";
  href: string;
  /** Whether this viewer is shown the tab. */
  isFor: (signedIn: boolean) => boolean;
  isActive: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  {
    key: "explore",
    href: "/",
    isFor: (signedIn) => !signedIn,
    isActive:
      (p) => p === "/" || p === "/session" || p.startsWith("/session/"),
  },
  {
    key: "study",
    href: "/mine",
    isFor: (signedIn) => signedIn,
    isActive:
      (p) => p === "/mine" || p === "/session" || p.startsWith("/session/"),
  },
  {
    key: "review",
    href: "/review",
    isFor: () => true,
    isActive: (p) => p === "/review",
  },
];

export function TopBarTabs() {
  const t = useTranslations("topbar");
  const pathname = usePathname();
  const { signedIn } = useSignInState();

  return (
    <nav className="flex items-center gap-1">
      {TABS.filter(({ isFor }) => isFor(signedIn)).map(
        ({ key, href, isActive }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-2 font-mono text-xs font-semibold uppercase tracking-[0.12em] transition-colors focus-ring md:px-3 md:text-sm",
                active
                  ? "text-engage"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              <Bubble state={active ? "active" : "empty"} />
              {t(key)}
            </Link>
          );
        },
      )}
    </nav>
  );
}
