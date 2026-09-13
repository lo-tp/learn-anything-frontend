import { CircleHelp, Settings } from "lucide-react";
import Link from "next/link";

/**
 * Top app bar — wordmark on the left, utility actions on the right.
 * Static placeholder; the History/Export destinations land with their
 * tickets on map #11.
 */
export function TopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-outline-variant bg-surface px-gutter">
      <Link href="/" className="font-display text-lg font-semibold text-primary">
        Learn Anything
      </Link>
      <nav className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Settings"
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
        >
          <Settings className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Help"
          className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
        >
          <CircleHelp className="size-5" />
        </button>
      </nav>
    </header>
  );
}
