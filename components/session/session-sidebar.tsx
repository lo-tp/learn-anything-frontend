"use client";

import { useEffect, useRef } from "react";
import { ListChecks, Presentation } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MaterialOut, QuestionItem, SlideItem } from "@/lib/api-client";
import { QuizQuestion } from "@/components/session/quiz-question";
import { SandboxFrame } from "@/components/sandbox/sandbox-frame";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/use-theme";
import { cn, inquiryInk, sandboxSlideSrc } from "@/lib/utils";

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

/**
 * A step summary's type — the rail's label voice. Named once because the
 * clipped divider and the slip that prints the same summary in full (#210) are
 * one text shown twice: set them differently and the reader reads them as two
 * things.
 */
const STEP_SUMMARY_VOICE =
  "font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-on-surface";

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
 * The rail is 320px wide and a step title is a sentence, so the divider's
 * summary line is the one on this surface that can clip: when it does, hovering
 * it prints the summary in full (#210).
 *
 * Cards are `div role="button"` (not `<button>`) because they embed
 * iframes and the quiz's option buttons; the previews are `aria-hidden`
 * and `pointer-events-none` so the whole card stays the single click
 * target. The parent (the session view) owns the deck and the active
 * index; cards report clicks through `onSelect`.
 *
 * The sidebar is a `md`-and-up affordance: below `md` it is hidden and the
 * deck is walked with the footer's prev/next controls (the design's mobile
 * rule — multi-pane workflows collapse).
 *
 * Whenever `activeIndex` changes — including via the bottom-right
 * prev/next buttons — the active card is scrolled into view
 * (`scrollIntoView`, `block: "nearest"`, i.e. the minimal scroll that
 * reveals it) (#81).
 */
export function SessionSidebar({
  groups,
  activeIndex,
  onSelect,
  inquiryId,
  previewFresh = new Map(),
}: {
  groups: SidebarGroup[];
  activeIndex: number;
  onSelect: (index: number) => void;
  /** The session id — its hash picks the inquiry's identity spot color
   *  this desk is printed in (Colour Press). */
  inquiryId: string;
  /**
   * Slides that have finished a rewrite, and how many times each has. Each
   * preview is its own document with its own module map, so a rewritten
   * slide's preview re-fetches only at a URL it has not fetched — the rail
   * must not keep showing the version the reader asked to be replaced (#213).
   * Unrewritten previews keep their constant per-theme `src`.
   */
  previewFresh?: ReadonlyMap<string, number>;
}) {
  const t = useTranslations("session");
  const { theme } = useTheme();
  const spot = inquiryInk(inquiryId);

  // Keep the active card visible (#81): the bottom-right prev/next buttons
  // change `activeIndex` without touching the sidebar's scroll position,
  // so the sidebar scrolls the newly-active card into view itself.
  const cardRefs = useRef(new Map<number, HTMLDivElement>());
  useEffect(() => {
    cardRefs.current.get(activeIndex)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [activeIndex]);

  return (
    <aside className="hidden h-full w-80 shrink-0 select-none flex-col border-r border-outline-variant bg-surface md:flex">
      <div className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col">
          {groups.map((group, stepNo) => (
            <li key={group.step.step_id} className="flex flex-col">
              {/* Step divider — the step summary splitting the item groups:
                  a filled number block printed in the inquiry's identity
                  spot and a dashed rule. */}
              <div className="my-4 flex items-center gap-2 px-1">
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-[3px] font-mono text-xs font-bold"
                  style={{
                    backgroundColor: `var(--${spot})`,
                    color: "var(--on-inq)",
                  }}
                >
                  {stepNo + 1}
                </span>
                {/* The step summary is the rail's line that can clip: the rail
                    is 320px wide and a step title is a sentence, so a long one
                    ends in an ellipsis. Hovering it prints the whole summary as
                    a slip, in the divider's own mono-caps voice (#210). */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn(STEP_SUMMARY_VOICE, "truncate")}>
                      {group.step.summary.title}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className={STEP_SUMMARY_VOICE}>
                    {group.step.summary.title}
                  </TooltipContent>
                </Tooltip>
                <span aria-hidden className="ml-1 flex-1 border-t border-dashed border-outline-variant/70" />
              </div>
              <ul className="flex flex-col gap-2">
                {group.items.map(({ index, item }) => {
                  const active = index === activeIndex;
                  return (
                    <li key={item.type === "slide" ? item.slide_id : item.id}>
                      <div
                        ref={(el) => {
                          if (el) cardRefs.current.set(index, el);
                          else cardRefs.current.delete(index);
                        }}
                        role="button"
                        tabIndex={0}
                        aria-current={active ? "true" : undefined}
                        aria-label={
                          item.type === "slide"
                            ? `${t("slide")} ${index + 1}`
                            : item.text
                        }
                        onClick={() => onSelect(index)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelect(index);
                          }
                        }}
                        className={cn(
                          "cursor-pointer rounded-md border p-2.5 outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/50",
                          active
                            ? "border-2 border-primary bg-surface-container-lowest shadow-[var(--shadow-sheet-raised)]"
                            : "border border-outline-variant/50 bg-surface-container-lowest/60 hover:border-outline-variant",
                        )}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          {item.type === "slide" ? (
                            <Presentation
                              className="size-4 shrink-0 text-on-surface-variant"
                              aria-hidden
                            />
                          ) : (
                            <ListChecks
                              className="size-4 shrink-0 text-on-surface-variant"
                              aria-hidden
                            />
                          )}
                          <span
                            className={cn(
                              "truncate font-mono text-[11px] uppercase tracking-[0.12em]",
                              active
                                ? "font-semibold text-primary"
                                : "text-on-surface-variant",
                            )}
                          >
                            {item.type === "slide" ? t("slide") : t("quiz")}
                          </span>
                        </div>
                        {item.type === "slide" ? (
                          /* Mini preview: the slide's sandbox route, scaled down.
                             A finished rewrite re-fetches it (#213). */
                          <div className="relative h-40 w-full overflow-hidden rounded-[3px] border border-outline-variant/60 bg-background">
                            <SandboxFrame
                              src={sandboxSlideSrc(
                                item.slide_id,
                                theme,
                                previewFresh.get(item.slide_id) ?? 0,
                              )}
                              mini
                              className="pointer-events-none absolute top-0 left-0 h-[720px] w-[1280px] origin-top-left scale-[0.22]"
                            />
                          </div>
                        ) : (
                          /* Mini preview: the question rendered as the main area shows it. */
                          <div className="relative h-40 w-full overflow-hidden rounded-[3px] border border-outline-variant/60 bg-background">
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
