"use client";

import { useState } from "react";
import {
  History,
  MessageSquareText,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** One line of the conversation shown above the intake box. */
export type RecentMessage = {
  role: "you" | "ai";
  text: string;
};

/**
 * The conversation the design mockup shows over the intake box (see
 * `design/home/new_session/code.html`). The parent can override `recentMessages`
 * once real per-session history exists; until then the dialog renders this
 * fixture so it matches the design out of the box.
 */
export const DEFAULT_RECENT_MESSAGES: RecentMessage[] = [
  {
    role: "you",
    text: "Can we start a deep dive into distributed consensus protocols like Raft?",
  },
  {
    role: "ai",
    text: "Certainly! Raft breaks consensus down into leader election, log replication, and safety. What specific aspect would you like to explore first?",
  },
  {
    role: "you",
    text: "Let's focus on how leader election handles split votes during network partitions.",
  },
];

type Status = "idle" | "pending" | "narrow" | "error";

/**
 * The new-session popup over the History (#26), per
 * `design/home/new_session/code.html`: a header, a read-only "Recent
 * Messages" preview, an intake textarea that POSTs to `/api/sessions`, and a
 * Send footer. Idle → pending ("Sending…", disabled) → either narrow feedback
 * (error color, below the textarea, modal stays open), a transport error, or
 * accept — which resets the form, closes the dialog, and calls `onAccept` so
 * the parent refetches the History.
 */
export function NewSessionDialog({
  open,
  onOpenChange,
  onAccept,
  recentMessages = DEFAULT_RECENT_MESSAGES,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after an accepted intake — the parent should refetch the History. */
  onAccept: () => void;
  /**
   * The conversation previewed above the intake box. Defaults to the design
   * fixture; pass `[]` to hide the section.
   */
  recentMessages?: RecentMessage[];
}) {
  const [paragraph, setParagraph] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const pending = status === "pending";

  /** Close the dialog, always leaving it pristine for the next opening. */
  function close() {
    setParagraph("");
    setStatus("idle");
    setMessage(null);
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
    } else {
      close();
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    setStatus("pending");
    setMessage(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paragraph }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        if (body?.verdict === "narrow") {
          setStatus("narrow");
          setMessage(body.feedback ?? "That's a bit thin — add a little more detail.");
        } else {
          onAccept();
          close();
          return;
        }
      } else if (res.status === 400) {
        setStatus("error");
        setMessage(body?.error ?? "That paragraph doesn't work — try again.");
      } else {
        setStatus("error");
        setMessage("Something went wrong starting your session. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong reaching the server. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="w-full max-w-2xl flex-col gap-0 overflow-hidden border-outline-variant bg-surface-container p-0 text-on-surface sm:max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="flex w-full flex-col">
          {/* Header — icon tile + title on the left, close at the right. */}
          <div className="flex items-center justify-between gap-4 border-b border-outline-variant/50 bg-surface-container-low px-6 py-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                <MessageSquareText className="size-5" aria-hidden />
              </span>
              <DialogTitle className="text-left font-display text-2xl font-semibold text-on-surface">
                Start New Session
              </DialogTitle>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-bright hover:text-on-surface"
              >
                <X className="size-5" aria-hidden />
              </button>
            </DialogClose>
          </div>

          {/* Body — Recent Messages preview + the intake textarea. */}
          <div className="flex flex-col gap-5 p-6">
            {recentMessages.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-xs font-medium uppercase tracking-wider text-on-surface-variant">
                    <History className="size-4 text-primary" aria-hidden />
                    Recent Messages
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant/70">
                    {recentMessages.length}{" "}
                    {recentMessages.length === 1 ? "message" : "messages"}
                  </span>
                </div>

                <div className="flex max-h-56 flex-col gap-3 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest/50 p-3 pr-2">
                  {recentMessages.map((entry, index) =>
                    entry.role === "you" ? (
                      <div key={index} className="flex flex-col items-end gap-1">
                        <span className="font-mono text-xs font-medium text-secondary">
                          You
                        </span>
                        <div className="max-w-[85%] rounded-xl rounded-tr-sm border border-outline-variant/30 bg-secondary-container px-3.5 py-2 text-sm text-on-surface">
                          {entry.text}
                        </div>
                      </div>
                    ) : (
                      <div key={index} className="flex flex-col items-start gap-1">
                        <span className="flex items-center gap-1 font-mono text-xs font-medium text-primary">
                          <Sparkles className="size-3.5 text-primary" aria-hidden />
                          Lumina AI
                        </span>
                        <div className="max-w-[85%] rounded-xl rounded-tl-sm border border-outline-variant/40 bg-surface-bright px-3.5 py-2.5 text-sm text-on-surface">
                          {entry.text}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="learning-goal"
                className="mb-2 block text-base font-medium text-on-surface"
              >
                What would you like to explore or learn?
              </label>
              <div className="relative">
                <textarea
                  id="learning-goal"
                  rows={3}
                  value={paragraph}
                  onChange={(e) => setParagraph(e.target.value)}
                  disabled={pending}
                  placeholder="Continue the discussion or describe the next query..."
                  className="w-full resize-none rounded-xl border border-outline-variant/40 bg-surface-bright p-4 text-base text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary disabled:opacity-60"
                />
              </div>
              {(status === "narrow" || status === "error") && (
                <p className="mt-2 text-sm text-error" aria-live="polite">
                  {message}
                </p>
              )}
            </div>
          </div>

          {/* Footer — Cancel + Send. */}
          <div className="flex justify-end gap-3 border-t border-outline-variant/50 bg-surface-container-low px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={close}
              className="h-auto border border-transparent px-4 py-2 text-on-surface-variant hover:border-outline-variant hover:bg-surface-bright hover:text-on-surface"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className={cn(
                "gap-2 px-6 py-2.5 text-on-primary-container hover:bg-primary-fixed hover:text-on-primary-container",
              )}
            >
              <Send className={cn("transition-transform", !pending && "group-hover:translate-x-0.5")} aria-hidden />
              {pending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
