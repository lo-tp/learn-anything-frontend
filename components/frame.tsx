import { TopBar } from "@/components/top-bar";

/**
 * Page frame — the chrome shared by all pages. Renders the `TopBar` above
 * the page's own content in a full-height column, so pages supply content
 * only. Server component; `children` must not contain event handlers.
 */
export function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar />
      {children}
    </div>
  );
}
