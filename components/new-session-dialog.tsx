"use client";

import { useState } from "react";
import { ArrowRight, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Status = "idle" | "pending" | "narrow" | "error";

/**
 * The new-session popup over the History (#26): an intake textarea that POSTs
 * to `/api/sessions`. Idle → pending ("Starting…", disabled) → either narrow
 * feedback (error color, below the textarea, modal stays open), a transport
 * error, or accept — which resets the form, closes the dialog, and calls
 * `onAccept` so the parent refetches the History.
 */
export function NewSessionDialog({
  open,
  onOpenChange,
  onAccept,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after an accepted intake — the parent should refetch the History. */
  onAccept: () => void;
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
      <DialogContent className="w-full max-w-lg gap-0 overflow-hidden border-outline-variant bg-surface-container p-0 text-on-surface sm:max-w-lg">
        <form onSubmit={handleSubmit} className="flex w-full flex-col">
          <DialogHeader className="border-b border-outline-variant/50 bg-surface-container-low px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-left font-display text-2xl text-on-surface">
              <Rocket className="size-6 text-primary" aria-hidden />
              Start a New Learning Journey
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 p-6">
            <label
              htmlFor="intake-paragraph"
              className="text-base text-on-surface"
            >
              What are we focusing on today?
            </label>
            <textarea
              id="intake-paragraph"
              rows={4}
              value={paragraph}
              onChange={(e) => setParagraph(e.target.value)}
              disabled={pending}
              placeholder="Describe your learning goal… (e.g., 'I want to understand Newton's second law and how force, mass, and acceleration fit together.')"
              className="w-full resize-none rounded-t-lg border-b-2 border-outline-variant bg-surface-bright p-4 text-base text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/50 focus:border-primary disabled:opacity-60"
            />
            {(status === "narrow" || status === "error") && (
              <p className="text-sm text-error" aria-live="polite">
                {message}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-outline-variant/50 bg-surface-container-low px-6 py-4">
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={close}
              className="text-on-surface-variant hover:text-on-surface"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className={cn(
                "gap-2 px-6 py-2 text-on-primary-container hover:bg-primary-fixed hover:text-on-primary-container",
              )}
            >
              {pending ? "Starting…" : "Start Session"}
              <ArrowRight
                className={cn(
                  "transition-transform",
                  !pending && "group-data-[slot=button]:group-hover:translate-x-1",
                )}
                aria-hidden
              />
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
