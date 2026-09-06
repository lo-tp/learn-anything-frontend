import { TopBar } from "@/components/top-bar";

/**
 * Page frame — the chrome shared by all pages. The `TopBar` is pinned to the
 * viewport top (`position: fixed`, h-16); the content below it fills the
 * remaining viewport height and scrolls internally. `pt-16` clears the fixed
 * bar. Server component; `children` must not contain event handlers.
 */
export function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden pt-16">
      <TopBar />
      {children}
    </div>
  );
}
