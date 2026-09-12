import { Presentation } from "lucide-react";
import type { MaterialOut, QuestionItem, SlideItem } from "@/lib/api-client";
import { QuizQuestion } from "@/components/session/quiz-question";
import { SandboxFrame } from "@/components/sandbox/sandbox-frame";
import { cn } from "@/lib/utils";

/** One item card in the sidebar, addressed by its flat deck index. */
export interface SidebarItemEntry {
  /** The item's index in the flattened deck (the view's `activeIndex`). */
  index: number;
  item: SlideItem | QuestionItem;
}

/** One step group: a divider (the step summary) plus its item cards. */
export interface SidebarGroup {
  step: MaterialOut;
  items: SidebarItemEntry[];
}

/** The sandbox URL that serves a slide item's content. */
const sandboxSrc = (slideId: string) =>
  `${process.env.NEXT_PUBLIC_SANDBOX_ORIGIN}/slides/${slideId}`;

/**
 * Left item sidebar for `/session/{sessionId}` (#47).
 *
 * The deck's items — one card per slide/question — rendered grouped by
 * their parent step: each step contributes a non-interactive divider
 * (step number + title, i.e. the step summary) followed by its item
 * cards. Each card shows its full content as a non-interactive mini
 * preview scaled down to fit the card — the slide's sandbox route, or
 * the question rendered exactly as the main area shows it — the same
 * treatment the classroom slide sidebar used.
 *
 * Cards are `div role="button"` (not `<button>`) because they embed
 * iframes and the quiz's option buttons; the previews are `aria-hidden`
 * and `pointer-events-none` so the whole card stays the single click
 * target. The parent (the session view) owns the deck and the active
 * index; cards report clicks through `onSelect`.
 */
export function SessionSidebar({
  groups,
  activeIndex,
  onSelect,
}: {
  groups: SidebarGroup[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <aside className="flex h-full w-80 shrink-0 select-none flex-col border-r border-outline-variant bg-surface">
      <div className="flex items-center p-3 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Materials
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-2.5">
          {groups.map((group, stepNo) => (
            <li key={group.step.step_id} className="flex flex-col gap-2">
              {/* Step divider — the step summary splitting the item groups. */}
              <div className="flex items-center gap-2 px-1">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-outline-variant/60 bg-surface-container font-mono text-[11px] font-semibold text-on-surface-variant">
                  {stepNo + 1}
                </span>
                <span className="truncate text-xs font-medium uppercase tracking-wide text-on-surface-variant">
                  {group.step.summary.title}
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {group.items.map(({ index, item }) => {
                  const active = index === activeIndex;
                  return (
                    <li key={item.type === "slide" ? item.slide_id : item.id}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-current={active ? "true" : undefined}
                        onClick={() => onSelect(index)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(index);
                          }
                        }}
                        className={cn(
                          "cursor-pointer rounded-xl border p-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/50",
                          active
                            ? "border-primary/60 bg-gradient-to-b from-surface-container-low to-surface-container-lowest shadow-md shadow-primary/10"
                            : "border-outline-variant/40 bg-surface-container-low/60 hover:border-outline-variant",
                        )}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          {item.type === "slide" ? (
                            <Presentation
                              className="size-4 shrink-0 text-on-surface-variant"
                              aria-hidden
                            />
                          ) : (
                            <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-outline-variant/60 text-[10px] font-semibold text-on-surface-variant">
                              Q
                            </span>
                          )}
                          <span
                            className={cn(
                              "truncate text-xs",
                              active
                                ? "font-medium text-primary"
                                : "text-on-surface-variant",
                            )}
                          >
                            {item.type === "slide" ? "Slide" : item.text}
                          </span>
                        </div>
                        {item.type === "slide" ? (
                          /* Mini preview: the slide's sandbox route, scaled down. */
                          <div className="relative h-40 w-full overflow-hidden rounded-lg border border-outline-variant/50 bg-background">
                            <SandboxFrame
                              src={sandboxSrc(item.slide_id)}
                              mini
                              className="pointer-events-none absolute top-0 left-0 h-[720px] w-[1280px] origin-top-left scale-[0.22]"
                            />
                          </div>
                        ) : (
                          /* Mini preview: the question rendered as the main area shows it. */
                          <div className="relative h-40 w-full overflow-hidden rounded-lg border border-outline-variant/50 bg-background">
                            <div
                              aria-hidden
                              className="pointer-events-none absolute top-0 left-0 w-[672px] origin-top-left scale-[0.41]"
                            >
                              <QuizQuestion
                                question={item}
                                selected={null}
                                onSelect={() => {}}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
