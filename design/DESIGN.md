---
name: Learn Anything — The Answer Sheet
description: Study as a sheet you fill in — a two-ink press on paper, rendered as exam paper (light) and its night-desk inversion (dark).
colors:
  print-ink: "#1f231a"
  paper-white: "#fcfaf1"
  exam-paper: "#f0eee3"
  sheet-stock: "#f7f4e9"
  pencil-meta: "#4b4839"
  pencil: "#565141"
  stamp-green: "#2e6b45"
  stamp-green-field: "#d5e4d9"
  red-pen: "#b3382b"
  red-pen-field: "#f1dcd5"
  rule: "#c9c5b4"
  rule-strong: "#6d6959"
  highlighter: "#d9bd6e"
typography:
  display:
    fontFamily: "Archivo, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.04em"
  headline:
    fontFamily: "Archivo, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
  title:
    fontFamily: "Archivo, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Source Sans 3, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "JetBrains Mono, PingFang SC, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.14em"
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 500
rounded:
  sm: "0.125rem"
  md: "0.25rem"
  lg: "0.375rem"
  xl: "0.5rem"
  full: "9999px"
spacing:
  margin-page: "2rem"
  gutter: "1.5rem"
components:
  button-ink:
    backgroundColor: "{colors.print-ink}"
    textColor: "{colors.paper-white}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
  button-reveal:
    backgroundColor: "transparent"
    textColor: "{colors.print-ink}"
    rounded: "3px"
    padding: "8px 20px"
  button-confidence:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.print-ink}"
    rounded: "3px"
    padding: "8px 16px"
  option-box:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.print-ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  sheet-card:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.print-ink}"
    rounded: "{rounded.lg}"
    padding: "20px 20px 20px 32px"
---

# Design System: Learn Anything — The Answer Sheet

> Supersedes the prior "Electric Vivid Modern" DESIGN.md, retired by the owner's decision on 2026-10-02; none of its tokens or vocabulary carry forward.

## Overview

**Creative North Star: "The Answer Sheet"**

Study is a sheet you fill in. Every surface is printed paper: a record header closed by a double rule, sessions as paper cards punched for a binder, questions as lettered option boxes, progress as a row of filled bubbles, phase as a rotated rubber stamp pressed onto the page. The system refuses the chat-hero arrangement and the progress-bar LMS dashboard outright; it holds instead to a two-ink press — print ink for action, red pen for correction, stamp green for verified, pencil for meta — on a paper ground with a faint grain (a fractal-noise texture at 3.5% opacity on the body) that says "sheet", not "panel".

The world ships in two complete renditions. Light is the exam paper: a pale warm stock (#f0eee3) with crisp near-white sheets. Dark is the *night desk*: the exact same press inverted — the ink roles become paper ink (#e7ebde) on a dark desk ground (#191c15). Both renditions are first-class (dual theme is a hard product requirement); the token values in this file's frontmatter are the exam-paper rendition, and the night-desk inversion is given in Colors so no role ever changes meaning between themes.

Type carries the same printed-form logic: Archivo sets record headers and sheet titles like a printed form masthead; Source Sans 3 is the plain body voice that a 10-year-old and a 70-year-old can both follow; JetBrains Mono is the form's own hand — sheet numbers, counters, and the labels pressed into stamps and confidence controls.

**Key Characteristics:**
- Two-ink discipline: ink for action, red pen only for misses/corrections/reveals, stamp green only for verified/passed, pencil for meta/pending/rules.
- Bubbles are the sole progress device — empty, filled, or current. No progress bars.
- Stamps (slightly rotated, double-ruled, monospace caps) are the phase vocabulary; session cards carry no stage vocabulary at all (product decision #46).
- Square-cut form geometry: form surfaces at or below 6px radius; full circles reserved for bubbles and punch holes.
- Ruled-paper panels, double-rule dividers, and a ruled meta strip with a red monospace "No." on every sheet card.
- No glow, no gradients, no glass. Depth is the contact shadow of paper on a desk.

## Colors

The palette is a two-ink press with exactly three marks and one bounded exception. The frontmatter is normative for the exam-paper (light) rendition; every role below maps 1:1 onto a token in `public/palette.css` (`--primary`, `--error`, `--tertiary`, `--secondary`, `--outline-variant`, …).

### Primary
- **Print Ink** (#1f231a, `--primary`): the action ink. Primary buttons, filled bubbles, the wordmark, current rail steps, the caret, and selection tint. On the night desk this role inverts to paper ink (#e7ebde) on the desk ground.

### Secondary
- **Pencil** (#565141, `--secondary`) and **Pencil Meta** (#4b4839, `--on-surface-variant`): the graphite voice. Pending states, timestamps, meta copy, "not reached" rules, work-in-progress phase stamps, and the mid rung of the confidence scale. Night desk: #565141 → #aab69c, meta text #4b4839 → #aab0a0.

### Tertiary
- **Stamp Green** (#2e6b45, `--tertiary`) on its **Verified Field** (#d5e4d9, `--tertiary-container`): reserved strictly for verified/passed outcomes — completed stamps, the correct option after a reveal, the graded "done" rung. Night desk: #85b896 on #2d4734.

### Neutral
- **Exam Paper** (#f0eee3, `--background`): the page ground — warm card stock, not pure white. Night desk: #191c15.
- **Paper White** (#fcfaf1, `--surface-container-lowest`): the sheet itself — history cards, quiz cards, option boxes, chips. Night desk: #121510.
- **Sheet Stock** (#f7f4e9, `--surface-container-low`): recessed form furniture — the progress rail strip, control chips. Night desk: #1e2218.
- **Rule** (#c9c5b4, `--outline-variant`) and **Rule Strong** (#6d6959, `--outline`): printed rules — borders, ruled-paper lines, double rules, dashed "ahead" connectors. Night desk: #c9c5b4 → #3c4133, #6d6959 → #8f9683.

### The Fourth Mark (bounded exception)
- **Red Pen** (#b3382b, `--error`) on its **Correction Field** (#f1dcd5, `--error-container`): reserved strictly for misses, corrections, and reveals — struck-through wrong options, "not quite", error states, and the red sheet number printed on every card. Night desk: #e0765c on #4d2118. It is the press's correction ink, not an alert color; it never marks success.
- **Highlighter** (#d9bd6e, `--marker`): the one wash outside the ink press, and it is bounded: a pale translucent highlighter (36% mix on the night desk, 52% on exam paper) used *only* on the learner's own narrowed goal inside the intake transcript. A highlighter belongs on an answer sheet — but only on the learner's own answer. Nothing else may use it.

**The Two-Ink Press Rule.** Every color in the app is one of the roles above, and each role is reserved: ink acts, red pen corrects, stamp green verifies, pencil annotates. A color that crosses its reservation is a bug, not a variant.

**The Red Sheet Number Rule.** Every filed sheet — a history card, a review card, the empty sheet — prints its identity as a red monospace "No." on its ruled header strip. It is the card's fingerprint, not decoration.

## Typography

**Display Font:** Archivo (500/600/700, via next/font), with PingFang SC / Microsoft YaHei fallthrough for CJK
**Body Font:** Source Sans 3 (400–700), same CJK fallthrough
**Label/Mono Font:** JetBrains Mono (400/700)

**Character:** Archivo is the printed-form grotesque — headers read like a masthead you were meant to fill in. Source Sans 3 is deliberately plain and high-legibility, so the teaching voice stays warm at any age. JetBrains Mono is the handwriting of the form itself: codes, counters, and the caps pressed into stamps and controls.

### Hierarchy
- **Display** (Archivo 700, 30px, uppercase, +0.04em tracking): the record header band title ("My Sessions") and the dialog masthead (20px, +0.06em).
- **Headline** (Archivo 700, 24px): empty-state and status-panel headings.
- **Title** (Archivo 600, 20px): sheet card goal titles, quiz question prompts, the session workspace header line.
- **Body** (Source Sans 3 400, 15px, line-height 1.625): all teaching copy, option text, explanations; notes at 14px in pencil meta. Copy columns cap around 65–75ch (max-w-2xl on quiz cards, max-w-md on notes).
- **Label** (JetBrains Mono 700, 11–12px, uppercase, +0.12–0.14em tracking): stamp captions, progress-rail step names, the REVEAL control, the AGAIN/HARD/GOOD/EASY confidence controls, verdict lines ("CORRECT", "NOT QUITE").
- **Code** (JetBrains Mono 400–500, 12px, not uppercase): sheet numbers, slide counters (`03/12`, zero-padded), timestamps, batch positions ("Question 2 of 5").

**The Printed-Form Rule.** Headings are set like a printed form: Archivo, uppercase where it is a form header or masthead, with widened tracking. The teaching voice itself is never uppercase and never the display face.

**The Mono-Vocabulary Rule.** JetBrains Mono is the form's hand. Its charter in the brief was codes and counters; the build extends that vocabulary to FORM labels — the caps on stamps and the REVEAL / AGAIN / HARD / GOOD / EASY controls read as printed form keys, and that is now the built rule. Mono still never sets body copy or teaching prose.

## Layout

Fixed chrome, internally scrolling sheets. The TopBar is pinned (`position: fixed`, 64px tall, closed with a double rule); the page frame clears it with `pt-16` and fills the viewport (`h-dvh`, overflow hidden) — each view scrolls in its own pane. The layout never relies on page-level scroll.

- **Home / record page:** content column maxes at 1200px, padded `margin-page` (2rem, 1rem at small widths via `p-4` under `md:`); the record header band sits above a single-column stack of sheet cards with 16px gaps, cards settling in with a 40ms stagger (capped at 320ms).
- **Intake dialog:** a full-bleed printed form; its transcript column is max-w-3xl; the transcript pane itself is a ruled-paper panel (rules every 32px, aligned to the panel's own scroll via `background-attachment: local`).
- **Session workspace and review deck:** quiz content maxes at 672px (max-w-2xl); the review card at 896px (max-w-3xl) with the confidence bar as the sheet's printed footer.
- **Spacing rhythm:** a 4px base rhythm; page margin 2rem (`--spacing-margin-page`), gutters 1.5rem (`--spacing-gutter`); sheet cards pad 20px with a 32px left margin reserved for punch holes.
- **Boundary of the system:** slide content inside the session workspace is LLM-authored material rendered in a sandboxed iframe (`components/sandbox/sandbox-frame.tsx`, which re-serves `public/palette.css` cross-origin). It is the learner's lesson, not app chrome — the design system governs the frame around it, never the content inside it.

## Elevation & Depth

Depth is the press of paper on a desk, never ambient glow. Sheets carry a two-part contact shadow (`--shadow-sheet`): a hard 1px edge line in the rule color, then a tight dark drop with a small blur. There are no large diffuse shadows, no glass, no gradients anywhere.

### Shadow Vocabulary
- **Sheet rest** (`box-shadow: 0 1px 0 <outline-variant 80%>, 0 2px 5px -2px <black 45%>`; light: `0 1px 0 <outline-variant 90%>, 0 2px 5px -2px <ink 22%>`): the default state of every sheet card and the ink-block CTA — the sheet's edge contact.
- **Sheet raised** (`box-shadow: 0 2px 0 <outline-variant 90%>, 0 8px 18px -6px <black 55%>`; light: with the drop tinted in ink instead of black): hover/attention state, paired with a −1px translate. Exactly one step of lift; there is no third level.

**The Sheet-Contact Rule.** Every lifted thing shows its edge. A shadow is always a contact line plus a tight drop; anything diffuse, wide, or colored is outside this world.

## Shapes

Form language is a pressed, square-cut form. Radii live on a short scale and hard-cap at 8px (`--radius-2xl`/`3xl`/`4xl` all collapse to 0.5rem in `app/globals.css`): sheet cards are gently cut at 6px (`rounded-lg`), option boxes and textareas at 4px (`rounded-md`), stamps, chips, and compact controls at a hard 3px, full rounding belongs exclusively to bubbles and punch holes (`rounded-full`). Dashes mean *not yet*: dashed outlines mark future rail steps and the blank writing area; solid rules mark what has been walked.

Recurring geometry: the double rule (`double-rule-b` — a 1px border with a hairline echo 3px below) closes every header band; the ruled-paper utility prints 32px form lines; the punch-hole margin (three small circle holes along the left edge) marks anything that is a filed sheet; stamps draw their inner border as an inset ring tinted from their own ink (`inset 0 0 0 1px currentColor 35%`), and are rotated −2° at rest — rotation is this world's native device for a pressed stamp, not a defect.

## Components

### Buttons
- **Shape:** nearly square; 4px radius for the ink block, 3px for stamp-style controls.
- **Primary ("ink block"):** solid print ink, paper-white text at 15px semibold, 12px×20px padding, resting at sheet contact and lifting −1px to `--shadow-sheet-raised` on hover. It is the one control on a page allowed to look heavy, and each page carries exactly one (`StartSessionButton`).
- **Outline stamp variant (REVEAL):** transparent, 2px print-ink border, mono-caps label, hover fills the block (`bg-primary`, ink-out text).
- **Confidence controls (AGAIN / HARD / GOOD / EASY):** sheet-white chips, 3px corners, mono caps, and a 3px top rule that *is* the scale — red pen → pencil → ink container → filled ink. Hover adopts its own rung color. They disable while a recording is in flight; a failed recording keeps the card on screen.

### Option Boxes (quiz / probe / review)
- **Style:** sheet-white boxes with a 1px rule border and a printed letter square (JetBrains Mono bold, 3px corners) — exactly like a printed question. Hover shifts the border to ink.
- **Revealed states:** correct → green letter square and green field at 50%; wrong pick → red letter square, red field, and the PenCross: two hand-drawn red strokes that ink in sequentially (320ms, second +140ms), never an icon with a dash trick; unreached options fade to 45% opacity. The explanation panel below is sheet-white with a 2px colored top rule matching the verdict (red / green / pencil).

### Sheet Cards (history, review deck, empty state)
- **Corner Style:** 6px. **Background:** Paper White on the page ground. **Border:** 1px rule. **Internal padding:** 20px, with a 32px left margin reserved for the punch-hole strip.
- **Ritual:** a ruled header strip carries the red monospace "No." and, right-aligned, a mono timestamp; the goal title sets below in Archivo 600. Cards land with `sheet-settle` on first paint and lift one step on hover.
- **Product rule #46:** session cards carry **no stage vocabulary**. The only in-progress signal is a quiet pencil note (mono, "generating…") while materials are produced. Phase is chrome for the session workspace, never a label on a history card.
- **Empty state:** a blank sheet waiting for its first entry — empty "No. ____" slot, printed instructions, a dashed ruled-paper writing area, and the page's one ink block at the foot.

### Stamps (PhaseIndicator)
- **Style:** a square, −2° rotated, double-outlined (inset currentColor ring) monospace-caps chip pressed in with `stamp-press`. Work-in-progress phases wear a pencil dashed outline; executing is a filled ink block; complete is the green stamp; error is the red-pen stamp. The same device scales up to a 96px completion stamp in the dialog.

### Progress Rail and Bubbles
- **Rail:** a printed row of four bubbles and mono-caps step labels under a double rule. Done steps link with a solid 2px ink rule; ahead steps link with a dashed rule. Step counters appear only under the active step.
- **Bubble:** 14px circles, three states only — empty (outline variant), filled (inks in with `bubble-fill`, solid primary), current (open ring with a breathing 1.5px ink dot). The bubble is the world's sole progress device; there are no bars, rings, or percentages.

### Form Surfaces
- **Intake transcript:** a ruled-paper panel; each entry is a left-ruled block — print-ink rule for the learner, pencil rule for the app — and the learner's narrowed goal is the only element allowed the highlighter wash.
- **Focus (all custom controls):** `focus-ring` — a 2px outline in the theme's ring token (ink on exam paper, paper ink on the night desk), offset 2px. The single visible keyboard-focus treatment.

### The Motion Grammar (signature behavior)
Three authored moments, used consistently, never scattered — `bubble-fill` (200ms), `stamp-press` (220ms, settles from scale 1.08/−4° to rest at −2°), `sheet-settle` (240ms, 6px rise) — plus the two pen strokes and the breathing dot. All share one easing, `cubic-bezier(0.16, 1, 0.3, 1)`, exponential ease-out from an already-visible default. Under `prefers-reduced-motion: reduce` every authored animation is switched off; nothing in the flow depends on motion to be understood.

## Do's and Don'ts

### Do:
- **Do** keep every color inside its press role: ink acts, red pen only corrects, stamp green only verifies, pencil only annotates.
- **Do** mark progress with bubbles only — empty, filled, or current — and connect walked steps with solid ink rules, ahead steps with dashed ones.
- **Do** set phase as a stamp: rotated −2°, double-outlined, monospace caps, pressed in.
- **Do** file every sheet the same way: punch-hole margin, ruled header strip, red monospace "No.", 6px corners, sheet-contact shadow.
- **Do** give each page exactly one ink block — the heavy solid-ink primary CTA.
- **Do** use the highlighter wash (`--marker`) on the learner's own narrowed goal in intake, and there only.
- **Do** keep type legible at any age in both scripts: Source Sans 3 body at 15px+, uppercase Archivo only for form headers, mono only for codes/counters/form labels.
- **Do** ship every surface in both renditions — exam paper and night desk — from the same role tokens.

### Don't:
- **Don't** use red pen on anything that succeeded, or stamp green on anything unverified.
- **Don't** put stage or phase vocabulary on session cards (product decision #46).
- **Don't** round form surfaces past 8px; full circles are reserved for bubbles and punch holes.
- **Don't** use glow, gradients, glass, or diffuse ambient shadows — depth is contact plus a tight drop.
- **Don't** use progress bars, rings, or percentage meters; the bubble row is the progress device.
- **Don't** treat LLM-authored slide content in the sandbox iframe as app chrome; the system frames it, never styles it from outside.
- **Don't** invent a second highlighter, a second accent, or a decorative color; the press has its quota.
