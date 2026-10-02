---
name: Learn Anything — The Answer Sheet (Colour Press)
description: Study as a sheet you fill in — a riso-style multicolor print on paper, rendered as riso paper (light) and its night-desk inversion (dark).
colors:
  print-ink: "#181420"
  press-paper: "#f8f2e6"
  sheet-stock: "#fcf5e8"
  paper-white: "#fffaf0"
  engage-blue: "#1450a3"
  engage-paper: "#fffaf0"
  riso-pink-red: "#c81e5b"
  correction-field: "#f9dbe4"
  riso-green: "#167a3f"
  verified-field: "#c9e8d2"
  pencil: "#5f5643"
  pencil-meta: "#4d4438"
  rule: "#d3c6b0"
  rule-strong: "#6b6053"
  highlighter-wash: "color-mix(in oklab, #ffcb05 48%, transparent)"
  inq-blue: "#1450a3"
  inq-flame: "#c2410c"
  inq-violet: "#5b3fb2"
  inq-ochre: "#8a6a00"
  ink-on-spot: "#fffaf0"
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
    textColor: "{colors.engage-blue}"
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

# Design System: Learn Anything — The Answer Sheet (Colour Press)

> The world is unchanged: sheets, ruled forms, bubbles, stamps, red sheet numbers, square geometry, the four authored motions, both languages, both themes. Only the color system was replaced — on 2026-10-02 the owner chose "The Colour Press" (option id `colour-press`, selected from three directions through the impeccable question flow); the prior "two-ink press" palette and its color rules retired that day, and every non-color rule carries forward unchanged. (The older "Electric Vivid Modern" DESIGN.md was retired the same day; none of its tokens carry forward.)

## Overview

**Creative North Star: "The Answer Sheet"**

Study is a sheet you fill in. Every surface is printed paper: a record header closed by a double rule, sessions as paper cards punched for a binder, questions as lettered option boxes, progress as a row of filled bubbles, phase as a rotated rubber stamp pressed onto the page. The system refuses the chat-hero arrangement and the progress-bar LMS dashboard outright; it holds instead to a **colour press** — ink-black carries the structure, engagement blue marks activity, riso pink-red corrects, riso green verifies, pencil annotates, and every inquiry is printed in its own spot color, so the History reads as a color-coded map of what you are curious about. The ground is warm press paper with a faint grain (a fractal-noise texture at 3.5% opacity on the body) that says "sheet", not "panel".

The world ships in two complete renditions. Light is the **riso paper**: a warm press stock (#f8f2e6) with crisp off-white sheets. Dark is the *night desk*: the exact same press inverted — fluorescent inks glowing on a deep desk ground (#17131f), the ink roles becoming paper ink (#f2e8d8). Both renditions are first-class (dual theme is a hard product requirement); the token values in this file's frontmatter are the riso-paper rendition, and the night-desk inversion is given in Colors so no role ever changes meaning between themes. In `public/palette.css` the `:root` block carries the night desk (the default any consumer gets without a class) and the `.light` block carries the riso-paper values.

Type carries the same printed-form logic: Archivo sets record headers and sheet titles like a printed form masthead; Source Sans 3 is the plain body voice that a 10-year-old and a 70-year-old can both follow; JetBrains Mono is the form's own hand — sheet numbers, counters, and the labels pressed into stamps and confidence controls.

**Key Characteristics:**
- Colour-press discipline: ink carries structure and action, engagement blue touches only activity and interaction, riso pink-red only misses/corrections/reveals, riso green only verified/passed, pencil only meta — and each inquiry carries its own reserved identity spot.
- Bubbles are the sole progress device — empty, filled, current, or active. No progress bars.
- Stamps (slightly rotated, double-ruled, monospace caps) are the phase vocabulary; session cards carry no stage vocabulary at all (product decision #46).
- Square-cut form geometry: form surfaces at or below 6px radius; full circles reserved for bubbles and punch holes.
- Ruled-paper panels, double-rule dividers, and a ruled meta strip with a red monospace "No." on every sheet card.
- A halftone dot screen names the press — printed only beside the record header band and the login masthead, nowhere else.
- No glow, no color-wash gradients, no glass. Depth is the contact shadow of paper on a desk.

## Colors

The palette is a riso-style multicolor press: ink-black structure plus strictly reserved role inks, with a four-color identity fan for inquiries. The frontmatter is normative for the riso-paper (light) rendition; every role below maps 1:1 onto a token in `public/palette.css` (`--primary`, `--engage`, `--error`, `--tertiary`, `--secondary`, `--inq-*`, `--outline-variant`, …). Night-desk values are given per role because the same role must read the same in both renditions.

### Primary
- **Print Ink** (#181420, `--primary`): the structure ink. Ink-block CTAs, filled (completed) bubbles, the wordmark, walked rail connectors, sheet titles' emphasis, the caret, and selection tint. Night desk: this role inverts to paper ink (#f2e8d8) on the desk ground.
- **Engagement Blue** (#1450a3, `--engage`; its text `--on-engage` #fffaf0): the activity ink, and it touches *only* activity and interaction — the keyboard focus ring (`--ring` is the blue in both themes), current and active bubbles, the executing and work-in-progress stamps, the active nav tab, the REVEAL outline control, option-box hover, plan step letters, and markdown-pane links in the document view. Night desk: #58a6ff (#0a1526 text).

### Secondary
- **Pencil** (#5f5643, `--secondary`) and **Pencil Meta** (#4d4438, `--on-surface-variant`): the graphite voice. Pending states, timestamps, meta copy, "not reached" rules, and the mid rung of the confidence scale. Night desk: #a89b8a / #b6ab9d.

### Tertiary
- **Riso Green** (#167a3f, `--tertiary`) on its **Verified Field** (#c9e8d2, `--tertiary-container`): reserved strictly for verified/passed outcomes — the complete stamp, the correct option after a reveal, verdict lines. Night desk: #3fc578 on #143821. Green is never a confidence rung and never an inquiry identity.

### Neutral
- **Riso Paper** (#f8f2e6, `--background`): the page ground — warm press stock, not pure white. Night desk: #17131f.
- **Paper White** (#fffaf0, `--surface-container-lowest`): the sheet itself — history cards, quiz cards, option boxes, chips. Night desk: #100c17.
- **Sheet Stock** (#fcf5e8, `--surface-container-low`): recessed form furniture — the progress rail strip, dialog footers. Night desk: #1d1727.
- **Rule** (#d3c6b0, `--outline-variant`) and **Rule Strong** (#6b6053, `--outline`): printed rules — borders, ruled-paper lines, double rules, dashed "ahead" connectors. Night desk: #453c55 / #9a8fa0.

### Reserved Identity Inks and the Highlighter
- **Inquiry Inks** (`--inq-blue` #1450a3, `--inq-flame` #c2410c, `--inq-violet` #5b3fb2, `--inq-ochre` #8a6a00; text on them is **Ink-on-Spot** `--on-inq` #fffaf0): each inquiry gets one spot deterministically from its session id (`inquiryInk` in `lib/utils.ts`); the spot prints on that study's sheet-card edge and the session sidebar's step number blocks, so History reads as a map of curiosities. Night desk (fluorescent): #58a6ff / #ff8a4d / #b39aff / #e8b95c, ink #17131f on them.
- **Riso Pink-Red** (#c81e5b, `--error`) on its **Correction Field** (#f9dbe4, `--error-container`): the press's correction ink, re-pressed as riso. Reserved strictly for misses, corrections, reveals, and the red sheet number printed on every card. It never marks success and is never an inquiry identity. Night desk: #f5578d on #4b1027.
- **Highlighter Wash** (`--marker`): the build's own exception token — a translucent wash of riso yellow (#ffcb05) mixed at 48% on riso paper, 32% on the night desk — used *only* on the learner's own narrowed goal inside the intake transcript. A highlighter belongs on an answer sheet — but only on the learner's own answer. Nothing else may use it.

*Inert scaffolding, recorded as-is:* `public/palette.css` and the `@theme` block also define `*-fixed`/`*-fixed-dim`, `inverse-*`, `--surface-tint`, `--chart-*`, and the shadcn `--sidebar-*` token families. No shipped surface consumes them; they are recorded as unused scaffolding, not as system resources.

**The Colour Press Rule.** Every color in the app holds its reserved role: ink structures, the blue touches only activity and interaction, pink-red corrects, green verifies, pencil annotates, inquiry spots identify. A color that crosses its reservation is a bug, not a variant.

**The Identity Is Not a Verdict Rule.** The inquiry fan is exactly blue / flame / violet / ochre, assigned deterministically per session; it deliberately excludes the correction pink-red and the verified green. Identity is never a verdict.

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
- **Label** (JetBrains Mono 700, 11–12px, uppercase, +0.12–0.14em tracking): stamp captions, progress-rail step names, the top-bar tabs, the REVEAL control, the AGAIN/HARD/GOOD/EASY confidence controls, verdict lines ("CORRECT", "NOT QUITE").
- **Code** (JetBrains Mono 400–500, 12px, not uppercase): sheet numbers, slide counters (`03/12`, zero-padded), timestamps, batch positions ("Question 2 of 5").

**The Printed-Form Rule.** Headings are set like a printed form: Archivo, uppercase where it is a form header or masthead, with widened tracking. The teaching voice itself is never uppercase and never the display face.

**The Mono-Vocabulary Rule.** JetBrains Mono is the form's hand. Its charter in the brief was codes and counters; the build extends that vocabulary to FORM labels — the caps on stamps, nav tabs, and the REVEAL / AGAIN / HARD / GOOD / EASY controls read as printed form keys, and that is now the built rule. Mono still never sets body copy or teaching prose.

## Layout

Fixed chrome, internally scrolling sheets. The TopBar is pinned (`position: fixed`, 64px tall, closed with a double rule); the page frame clears it with `pt-16` and fills the viewport (`h-dvh`, overflow hidden) — each view scrolls in its own pane. The layout never relies on page-level scroll.

- **Home / record page:** content column maxes at 1200px, padded `margin-page` (2rem, 1rem at small widths via `p-4` under `md:`); the record header band sits above a single-column stack of sheet cards with 16px gaps, cards settling in with a 40ms stagger (capped at 320ms).
- **Intake dialog:** a full-bleed printed form; its transcript column is max-w-3xl; the transcript pane itself is a ruled-paper panel (rules every 32px, aligned to the panel's own scroll via `background-attachment: local`).
- **Session workspace and review deck:** quiz content maxes at 672px (max-w-2xl); the review card at 896px (max-w-3xl) with the confidence bar as the sheet's printed footer; a `md`-and-up item sidebar (w-80) walks the deck, collapsing to the footer's prev/next controls below `md`.
- **Spacing rhythm:** a 4px base rhythm; page margin 2rem (`--spacing-margin-page`), gutters 1.5rem (`--spacing-gutter`); sheet cards pad 20px with a 32px left margin reserved for punch holes.
- **Boundary of the system:** slide content inside the session workspace is LLM-authored material rendered in a sandboxed iframe (`components/sandbox/sandbox-frame.tsx`, which re-serves `public/palette.css` cross-origin; the app's theme is handed to it as a `?theme=` param so slides match the palette, #78). It is the learner's lesson, not app chrome — the design system governs the frame around it, never the content inside it.

## Elevation & Depth

Depth is the press of paper on a desk, never ambient glow. Sheets carry a two-part contact shadow (`--shadow-sheet`): a hard 1px edge line in the rule color, then a tight dark drop with a small blur. There are no large diffuse shadows, no glass, no color-wash gradients anywhere.

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
- **Outline stamp controls:** 3px corners, 2px border, mono-caps label; hover fills the block. Color follows what the control does: navigation-back prints in ink; **REVEAL** prints in engagement blue (its blue border/text, hover fills blue with paper text) because revealing is an interaction, not navigation.
- **Confidence controls (AGAIN / HARD / GOOD / EASY):** sheet-white chips, 3px corners, mono caps, and a 3px top rule that *is* the scale — riso pink-red (a recorded lapse) → pencil → ink container → filled ink. No green appears in the scale: verified green belongs to outcomes, never to self-reported confidence. Hover adopts its own rung color. They disable while a recording is in flight; a failed recording keeps the card on screen.

### Option Boxes (quiz / probe / review)
- **Style:** sheet-white boxes with a 1px rule border and a printed letter square (JetBrains Mono bold, 3px corners) — exactly like a printed question. Hover shifts the border to engagement blue (the interaction ink).
- **Revealed states:** correct → green letter square and green field at 50%; wrong pick → pink-red letter square, correction field, and the PenCross: two hand-drawn red strokes that ink in sequentially (320ms, second +140ms), never an icon with a dash trick; unreached options fade to 45% opacity. The explanation panel below is sheet-white with a 2px colored top rule matching the verdict (pink-red / green / rule-strong).

### Sheet Cards (history, review deck, empty state)
- **Corner Style:** 6px. **Background:** Paper White on the page ground. **Border:** 1px rule. **Internal padding:** 20px, with a 32px left margin reserved for the punch-hole strip.
- **Identity edge:** every history card carries a 5px full-height color press on its left edge in its inquiry's spot (`var(--inq-*)` via `inquiryInk`) — History reads as a color-coded map. The spot is identity only; it never carries verdict meaning.
- **Ritual:** a ruled header strip carries the red monospace "No." and, right-aligned, a mono timestamp; the goal title sets below in Archivo 600. Cards land with `sheet-settle` on first paint and lift one step on hover.
- **Product rule #46:** session cards carry **no stage vocabulary**. The only in-progress signal is a quiet pencil note (mono, "generating…") while materials are produced. Phase is chrome for the session workspace, never a label on a history card.
- **Empty state:** a blank sheet waiting for its first entry — empty "No. ____" slot, printed instructions, a dashed ruled-paper writing area, and the page's one ink block at the foot.

### Stamps (PhaseIndicator)
- **Style:** a square, −2° rotated, double-outlined (inset currentColor ring) monospace-caps chip with a 14px glyph icon, pressed in with `stamp-press`. Work-in-progress phases (clarifying, probing, planning, reviewing, generating) wear an engagement-blue **dashed** outline; executing is a filled engagement-blue block; complete is the green stamp; error is the pink-red stamp; the no-session "ready" state is a pencil dashed stamp. The same device scales up to a 96px completion stamp in the dialog.

### Progress Rail and Bubbles
- **Rail:** a printed row of four bubbles and mono-caps step labels under a double rule on sheet stock. Done steps link with a solid 2px ink rule; ahead steps link with a dashed rule. Step counters appear only under the active step.
- **Bubble:** 14px circles, four states only — empty (outline-variant), filled (done: inks in with `bubble-fill`, solid print ink), current (being worked: engagement-blue ring with a breathing blue dot), active (the place you are standing: filled engagement blue). The bubble is the world's sole progress device; there are no bars, rings, or percentages.

### Navigation (TopBar tabs)
- Mono-caps tabs (JetBrains Mono, +0.12em tracking) with a bubble marker: the active tab prints in engagement blue with a filled-blue bubble and `aria-current="page"`; inactive tabs sit in pencil meta and lighten to surface on hover. Active state is derived from the route, and the tabs shrink below `md` rather than hide.

### Session Sidebar
- Item cards walk the deck; each step group opens with a filled number block printed in the inquiry's identity spot (`var(--inq-*)`, `--on-inq` text, 3px corners) beside its mono-caps summary and a dashed rule. Inactive cards sit at a 1px half-rule border; the active card is outlined 2px in print ink and lifted to `--shadow-sheet-raised`.

### Form Surfaces
- **Intake transcript:** a ruled-paper panel; each entry is a left-ruled block — print-ink rule for the learner, outline rule for the app — the narrowed-goal echo is the only element allowed the highlighter wash (`bg-[var(--marker)]`), and the plan's step letters print in engagement blue.
- **Focus (custom controls, buttons, links, cards):** `focus-ring` — a 2px outline in `--ring`, which is engagement blue in both themes, offset 2px (focus is interaction, and interaction belongs to the blue). shadcn primitives carry their own rings; native text inputs/textareas currently use a soft ink-tinted ring (`ring-primary/25` at 2px) instead of the blue treatment.

### The Halftone Screen (where the press shows)
- A field of dots in the current text color (`halftone` — radial dots on a 7px screen) names the riso press. The build prints it in exactly two places: behind the CTA end of the record header band (engagement blue at 13% opacity, `md` and up) and beside the login sheet's wordmark (blue at 25%, 40px square). It is a signature accent, not a required decoration; nothing else wears it.

### The Motion Grammar (signature behavior)
Three authored moments, used consistently, never scattered — `bubble-fill` (200ms), `stamp-press` (220ms, settles from scale 1.08/−4° to rest at −2°), `sheet-settle` (240ms, 6px rise) — plus the two pen strokes and the breathing dot. All share one easing, `cubic-bezier(0.16, 1, 0.3, 1)`, exponential ease-out from an already-visible default. Under `prefers-reduced-motion: reduce` every authored animation is switched off; nothing in the flow depends on motion to be understood.

## Do's and Don'ts

### Do:
- **Do** keep every color inside its press role: ink structures, the engagement blue only marks activity and interaction (focus, current, running, active nav, reveal), pink-red only corrects, green only verifies, pencil only annotates.
- **Do** give each inquiry its spot from `inquiryInk` and use it only as identity — sheet-card edge and sidebar step blocks.
- **Do** mark progress with bubbles only — empty, filled, current, active — and connect walked steps with solid ink rules, ahead steps with dashed ones.
- **Do** set phase as a stamp: rotated −2°, double-outlined, monospace caps, pressed in; blue while working, green when complete, pink-red on error.
- **Do** file every sheet the same way: punch-hole margin, ruled header strip, red monospace "No.", 6px corners, sheet-contact shadow.
- **Do** give each page exactly one ink block — the heavy solid-ink primary CTA.
- **Do** use the highlighter wash (`--marker`) on the learner's own narrowed goal in intake, and there only.
- **Do** keep type legible at any age in both scripts: Source Sans 3 body at 15px+, uppercase Archivo only for form headers, mono only for codes/counters/form labels.
- **Do** ship every surface in both renditions — riso paper and night desk — from the same role tokens.

### Don't:
- **Don't** use pink-red on anything that succeeded, or green on anything unverified (including the confidence scale).
- **Don't** assign the correction pink-red or the verified green as an inquiry identity spot; the fan is blue / flame / violet / ochre.
- **Don't** use the engagement blue on anything static or structural — headings, sheet bodies, completed bubbles stay ink.
- **Don't** put stage or phase vocabulary on session cards (product decision #46).
- **Don't** round form surfaces past 8px; full circles are reserved for bubbles and punch holes.
- **Don't** use glow, color-wash gradients, glass, or diffuse ambient shadows — depth is contact plus a tight drop; the halftone dot screen is a dot screen, not a gradient wash.
- **Don't** use progress bars, rings, or percentage meters; the bubble row is the progress device.
- **Don't** treat LLM-authored slide content in the sandbox iframe as app chrome; the system frames it, never styles it from outside.
- **Don't** invent a second highlighter, a fifth inquiry ink, or a decorative color; the press has its quota.
