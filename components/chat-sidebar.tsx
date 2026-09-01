import { CheckCircle2, MessagesSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The chat sidebar — the assistant conversation for one session.
 *
 * Static placeholder of the design shell: real messages arrive via the
 * `useChat` client and the per-session stream route (later tickets on
 * map #11). No state-management or form libraries are in the stack.
 */

const SAMPLE_CHOICES = [
  "A push or pull that changes an object&apos;s motion",
  "A kind of energy stored in matter",
  "The speed at which an object is moving",
  "None of these — not sure",
];

export function ChatSidebar() {
  return (
    <aside className="z-40 flex h-full w-[320px] shrink-0 flex-col border-r border-outline-variant bg-surface-container-low">
      {/* Assistant header */}
      <div className="shrink-0 flex items-center justify-between border-b border-outline-variant bg-surface-container-low p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/20">
            <MessagesSquare className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface">
              Your learning assistant
            </h2>
            <p className="font-label text-[10px] text-on-surface-variant">
              Ready to probe your boundary
            </p>
          </div>
        </div>
      </div>

      {/* Chat history — placeholder conversation */}
      <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-4">
        {/* Learner message */}
        <div className="flex justify-end">
          <div className="max-w-[85%] border-l-2 border-outline-variant py-1 pl-4">
            <p className="text-sm text-on-surface">
              I want to learn Newton&apos;s second law of motion.
            </p>
          </div>
        </div>

        {/* Assistant message */}
        <div className="flex justify-start">
          <div className="max-w-[90%] rounded-lg border border-outline-variant/30 bg-surface-container-high p-4 shadow-sm">
            <p className="mb-2 text-sm text-on-surface">
              Great target. First, a few quick questions to find your
              boundary — where you know and where you don&apos;t.
            </p>
            <p className="mb-3 text-sm text-on-surface">
              1. In physics, what does “force” mean?
            </p>

            {/* Choice cards */}
            <div className="mt-4 flex flex-col gap-2">
              {SAMPLE_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className="rounded-md border border-outline-variant bg-surface p-3 text-left transition-colors hover:bg-surface-container-highest focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <span className="block text-center text-[11px] leading-snug text-on-surface-variant">
                    {choice}
                  </span>
                </button>
              ))}
            </div>

            <Button
              className="mt-4 w-full"
              variant="default"
              size="sm"
              disabled
            >
              <CheckCircle2 className="size-4" />
              Confirm selection
            </Button>
          </div>
        </div>
      </div>

      {/* Chat input — inert until the turn route exists */}
      <div className="shrink-0 border-t border-outline-variant bg-surface-container-low p-4">
        <div className="relative">
          <textarea
            rows={1}
            disabled
            placeholder="Reply to your assistant…"
            className="w-full resize-none border-x-0 border-t-0 border-b border-outline-variant bg-transparent py-3 pr-10 text-sm text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            aria-label="Send"
            disabled
            className="absolute bottom-3 right-2 text-primary disabled:opacity-50"
          >
            <Send />
          </button>
        </div>
      </div>
    </aside>
  );
}
