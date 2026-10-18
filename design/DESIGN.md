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
  meta:
    fontFamily: "Source Sans 3, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.71
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
  intake-field:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.print-ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  intake-option-row:
    backgroundColor: "transparent"
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

> The world is unchanged: sheets, ruled forms, bubbles, stamps, red sheet numbers, square geometry, the four authored motions, both languages, both themes. Only the color system was replaced — on 2026-10-02 the owner chose "The Colour Press" (option id `colour-press`, selected from three directions through the impeccable question flow); the prior "two-ink press" palette and its color rules retired that day, and every non-color rule carries forward unchanged. (The older "Electric Vivid Modern" DESIGN.md was retired the same day; none of its tokens carry forward.) The same day, the dark **night-desk** rendition was reworked: its ground moved from a cool purple dark (#17131f) to a deep *warm* desk in the paper's own hue family, role inks were raised to a glowing level while keeping their exact light-world hues, and dark sheets now sit *above* the desk (paper catching lamplight) rather than sinking below it. No role, hue family, or non-color rule changed.
>
> On 2026-10-18 one surface changed worlds. The Session intake sheet (`views/mine/new-session-dialog.tsx`) was rebuilt as the plain form the owner asked for on 2026-10-15 ("I just want a simple form… It must be easy to use"), and the palette was pinned at the same time: `public/palette.css` and its reserved roles are binding in both renditions, and a redesign may replace type, geometry, material, composition and motion but not re-colour the app (PRODUCT.md, Brand Commitments). What retired is the intake sheet's *own* previous expression — the transcript of left-ruled chat bubbles on a ruled-paper panel, the mono-caps masthead and labels, the in-sheet progress rail, the −3° APPROVED stamp. What did not retire is any of those devices: ruled paper, stamps, bubbles, monospace form keys, lettered option boxes, the double rule and the sheet contact shadows all remain native to the surfaces that still use them. This file now records both idioms and which surface each one belongs to.

## Overview

**Creative North Star: "The Answer Sheet"**

Study is a sheet you fill in. Every surface is printed paper: a record header closed by a double rule, sessions as paper cards punched for a binder, questions as lettered option boxes, progress as a row of filled bubbles, phase as a rotated rubber stamp pressed onto the page. The system refuses the chat-hero arrangement and the progress-bar LMS dashboard outright; it holds instead to a **colour press** — ink-black carries the structure, engagement blue marks activity, riso pink-red corrects, riso green verifies, pencil annotates, and every inquiry is printed in its own spot color, so the History reads as a color-coded map of what you are curious about. The ground is warm press paper with a faint grain (a fractal-noise texture at 3.5% opacity on the body) that says "sheet", not "panel".

Since 2026-10-18 the "sheet you fill in" is drawn literally on one surface: the Session intake is a plain form on that same ground — one column of labelled items, the questions and answers kept on the sheet as the record itself, the open ask below them. It is the system's low-ceremony idiom (the owner's standing commitment: plain beats fancy), and it borrows none of the printed-form devices. Everything else in the app still prints: record headers, filed cards, lettered option boxes, stamps and bubbles. Both idioms draw their depth, their colour roles, and their type ramp from the same tokens.

The world ships in two complete renditions. Light is the **riso paper**: a warm press stock (#f8f2e6) with crisp off-white sheets. Dark is the *night desk*: the exact same press shown at night — glowing inks on a deep **warm** desk (#1d1813, deliberately in the paper's own hue family rather than a cool/purple dark), the ink roles becoming paper ink (#f4efe1). On the night desk a sheet is *lighter* than the desk (paper lit by a lamp), so `--surface-container-lowest` (#312a21) sits above the ground and recessed furniture (`--surface-container-low`, #15100c) sinks below it — the reverse of the earlier cool-purple rendering, but the same "sheet on a desk" reading the light world uses. Both renditions are first-class (dual theme is a hard product requirement); the token values in this file's frontmatter are the riso-paper rendition, and the night-desk inversion is given in Colors so no role ever changes meaning between themes. In `public/palette.css` the `:root` block carries the night desk (the default any consumer gets without a class) and the `.light` block carries the riso-paper values.

Type carries the same printed-form logic on the record surfaces: Archivo sets record headers and sheet titles like a printed form masthead; Source Sans 3 is the plain body voice that a 10-year-old and a 70-year-old can both follow; JetBrains Mono is the record's own hand — sheet numbers, counters, and the labels pressed into stamps and confidence controls. The Session intake sheet carries only the middle voice: its title, its reading text, and its labels are one body face on the 20/15/14 ramp, sentence case.

**Key Characteristics:**
- Colour-press discipline: ink carries structure and action, engagement blue touches only activity and interaction, riso pink-red only misses/corrections/reveals, riso green only verified/passed, pencil only meta — and each inquiry carries its own reserved identity spot.
- Bubbles are the sole progress device — empty, filled, current, or active. No progress bars.
- Stamps (slightly rotated, double-ruled, monospace caps) are the phase vocabulary; session cards carry no stage vocabulary at all (product decision #46).
- Square-cut form geometry: form surfaces at or below 6px radius; full circles reserved for bubbles and punch holes.
- Ruled-paper writing areas, double-rule dividers, punch-hole margins and a ruled meta strip with a red monospace "No." on every filed sheet card.
- Two form idioms, cleanly separated. The record surfaces print like a form (Archivo caps, monospace keys, ruled paper). The Session intake sheet is a plain form: one column, sentence-case body type on the 20/15/14 ramp, a filled container for anything already recorded, an outlined full-width row for anything still to be pressed. Neither idiom is banned; each belongs to its own surface.
- A halftone dot screen names the press — printed only beside the record header band and the login masthead, nowhere else.
- No glow, no color-wash gradients, no glass. Depth is the contact shadow of paper on a desk, or — on the plain form — one tonal step between the ground and the field.

## Colors

The palette is a riso-style multicolor press: ink-black structure plus strictly reserved role inks, with a four-color identity fan for inquiries. The frontmatter is normative for the riso-paper (light) rendition; every role below maps 1:1 onto a token in `public/palette.css` (`--primary`, `--engage`, `--error`, `--tertiary`, `--secondary`, `--inq-*`, `--outline-variant`, …). Night-desk values are given per role because the same role must read the same in both renditions.

### Primary
- **Print Ink** (#181420, `--primary`): the structure ink. Ink-block CTAs, filled (completed) bubbles, the wordmark, walked rail connectors, sheet titles' emphasis, the caret, and selection tint. Night desk: this role inverts to paper ink (#f4efe1) on the warm desk ground.
- **Engagement Blue** (#1450a3, `--engage`; its text `--on-engage` #fffaf0): the activity ink, and it touches *only* activity and interaction — the keyboard focus ring (`--ring` is the blue in both themes), current and active bubbles, the executing and work-in-progress stamps, the active nav tab, the REVEAL outline control, option-box hover, the intake sheet's open-field focus and its option-row hover, and markdown-pane links in the document view. Night desk: #4299f0 (#0b141e text).

### Secondary
- **Pencil** (#5f5643, `--secondary`) and **Pencil Meta** (#4d4438, `--on-surface-variant`): the graphite voice. Pending states, timestamps, meta copy, "not reached" rules, and the mid rung of the confidence scale. Night desk: #ab9a7c / #c6b89f.

### Tertiary
- **Riso Green** (#167a3f, `--tertiary`) on its **Verified Field** (#c9e8d2, `--tertiary-container`): reserved strictly for verified/passed outcomes — the complete stamp, the correct option after a reveal, verdict lines. Night desk: #39d085 on #163b29. Green is never a confidence rung and never an inquiry identity.

### Neutral
- **Riso Paper** (#f8f2e6, `--background`): the page ground — warm press stock, not pure white. Night desk: #1d1813 (a warm desk in the paper's own hue family, not a cool/purple dark).
- **Paper White** (#fffaf0, `--surface-container-lowest`): the sheet itself — history cards, quiz cards, option boxes, chips. Night desk: #312a21 — on the night desk the sheet is *lighter* than the desk (paper catching lamplight), not a recessed pit.
- **Sheet Stock** (#fcf5e8, `--surface-container-low`): recessed form furniture — the progress rail strip, dialog footers. Night desk: #15100c — recessed furniture sits *below* the desk on the night desk.
- **Rule** (#d3c6b0, `--outline-variant`) and **Rule Strong** (#6b6053, `--outline`): printed rules — borders, ruled-paper lines, double rules, dashed "ahead" connectors. Night desk: #685740 / #ab997c.

### Reserved Identity Inks and the Highlighter
- **Inquiry Inks** (`--inq-blue` #1450a3, `--inq-flame` #c2410c, `--inq-violet` #5b3fb2, `--inq-ochre` #8a6a00; text on them is **Ink-on-Spot** `--on-inq` #fffaf0): each inquiry gets one spot deterministically from its session id (`inquiryInk` in `lib/utils.ts`); the spot prints on that study's sheet-card edge and the session sidebar's step number blocks, so History reads as a map of curiosities. Night desk (glowing inks, light-world hues held): #4299f0 / #fa7f42 / #a98de2 / #efc439, ink #1d1813 on them.
- **Riso Pink-Red** (#c81e5b, `--error`) on its **Correction Field** (#f9dbe4, `--error-container`): the press's correction ink, re-pressed as riso. Reserved strictly for misses, corrections, reveals, and the red sheet number printed on every card. It never marks success and is never an inquiry identity. Night desk: #ee637c on #3f1820.
- **Highlighter Wash** (`--marker`): the build's own exception token — a translucent wash of riso yellow (#ffcb05) mixed at 48% on riso paper, 32% on the night desk — used *only* on the narrowed-goal line the app echoes back onto the Session intake sheet. A highlighter belongs on an answer sheet — but only on the learner's own answer. Nothing else may use it.

*Inert scaffolding, recorded as-is:* `public/palette.css` and the `@theme` block also define `*-fixed`/`*-fixed-dim`, `inverse-*`, `--surface-tint`, `--chart-*`, and the shadcn `--sidebar-*` token families. No shipped surface consumes them; they are recorded as unused scaffolding, not as system resources.

**The Colour Press Rule.** Every color in the app holds its reserved role: ink structures, the blue touches only activity and interaction, pink-red corrects, green verifies, pencil annotates, inquiry spots identify. A color that crosses its reservation is a bug, not a variant.

**The Identity Is Not a Verdict Rule.** The inquiry fan is exactly blue / flame / violet / ochre, assigned deterministically per session; it deliberately excludes the correction pink-red and the verified green. Identity is never a verdict.

**The Red Sheet Number Rule.** Every filed sheet — a history card, a review card, the empty sheet — prints its identity as a red monospace "No." on its ruled header strip. It is the card's fingerprint, not decoration.

**The One State Device Rule.** On the intake sheet a container's fill *is* its state, and it is the only state device that sheet has: filled paper (`--surface-container-lowest` behind a 1px rule) means the answer is already recorded; an outlined full-width row (no fill, 1px rule, blue border on hover) means the choice is still open. Nothing else marks state there — no leading marker, no check, no ring. A circle that never fills promises a selection state the row does not have.

## Typography

**Display Font:** Archivo (500/600/700, via next/font), with PingFang SC / Microsoft YaHei fallthrough for CJK
**Body Font:** Source Sans 3 (400–700), same CJK fallthrough
**Label/Mono Font:** JetBrains Mono (400/700)

**Character:** Archivo is the printed-form grotesque — record headers read like a masthead you were meant to fill in. Source Sans 3 is deliberately plain and high-legibility, so the teaching voice stays warm at any age, and it is also the only voice the Session intake sheet uses. JetBrains Mono is the handwriting of the record surfaces: codes, counters, and the caps pressed into stamps and controls.

### Hierarchy
- **Display** (Archivo 700, 30px, uppercase, +0.04em tracking): the record header band title ("My Sessions", "Explore"). No surface prints a 20px display masthead any more; the intake sheet's title sits at 20px in the body face (see Title).
- **Headline** (Archivo 700, 24px): empty-state and status-panel headings.
- **Title** (Archivo 600, 20px): sheet card goal titles, quiz question prompts, the session workspace header line. The Session intake sheet's own title is the same 20px rung set in Source Sans 3 at 600, sentence case — a title rung is a size, not a claim on the display face.
- **Body** (Source Sans 3 400, 15px, line-height 1.625, semibold 600 where a line is a heading-in-a-field or a plan step title): all teaching copy, option text, plan steps, the words the learner wrote. Copy columns cap around 65–75ch (max-w-2xl on quiz cards, an explicit 68ch on the intake record, max-w-md on notes).
- **Meta** (Source Sans 3 400, 14px, line-height 1.71 as recorded; single-line meta closes to 1.43): the annotation rung — a field's label, the position sentence in the intake header, in-flight notes, error lines, verdict captions ("Correct." / "Not quite."), probe explanations, the plan's "Builds on:" line. Labels and verdicts take the 600 weight of the same rung; the colour is pencil meta (`--on-surface-variant`) unless the line reports a verdict, in which case it wears the role ink that verdict calls for (green / pink-red). Meta is never uppercase and never monospace, and it is not a smaller body: it is what the form says *about* the field rather than what the field says.
- **Label** (JetBrains Mono 700, 11–12px, uppercase, +0.12–0.14em tracking): stamp captions, progress-rail step names, the top-bar tabs, the REVEAL control, the AGAIN/HARD/GOOD/EASY confidence controls, verdict lines ("CORRECT", "NOT QUITE"), and the form keys on the sign-in and regenerate-slide sheets.
- **Code** (JetBrains Mono 400–500, 12px, not uppercase): sheet numbers, zero-padded counters (`03/12`, which stay where they already appear), timestamps, batch positions ("Question 2 of 5").

**The Printed-Form Rule.** Record headings are set like a printed form: Archivo, uppercase where it is a record header band, with widened tracking. The teaching voice itself is never uppercase and never the display face.

**The One Voice Per Sheet Rule.** A surface picks one label voice and uses it everywhere on that surface. The sign-in and regenerate-slide sheets print monospace form keys (11–12px caps, +0.12–0.14em). The Session intake sheet is set entirely in the body face: 20px title / 15px reading text / 14px labels and meta, sentence case, no caps and no monospace anywhere on it. What decides which a surface gets is what the surface asks of the reader — a form the learner answers in prose is not a form you fill in by code.

**The Mono-Vocabulary Rule.** JetBrains Mono is the record's hand. Its charter in the brief was codes and counters; the build extends that vocabulary to FORM labels — the caps on stamps, nav tabs, the sign-in fields, and the REVEAL / AGAIN / HARD / GOOD / EASY controls read as printed form keys, and that is the built rule for the surfaces that print in this voice. Mono still never sets body copy or teaching prose, and the intake sheet's labels are meta in the body face, not form keys.

## Layout

Fixed chrome, internally scrolling sheets. The TopBar is pinned (`position: fixed`, 64px tall, closed with a double rule); the page frame clears it with `pt-16` and fills the viewport (`h-dvh`, overflow hidden) — each view scrolls in its own pane. The layout never relies on page-level scroll.

- **Home / record page:** content column maxes at 1200px, padded `margin-page` (2rem, 1rem at small widths via `p-4` under `md:`); the record header band sits above a single-column stack of sheet cards with 16px gaps, cards settling in with a 40ms stagger (capped at 320ms).
- **Session intake sheet:** a full-viewport plain form (`inset-0`, `rounded-none`, no border, no padding) opened over `/mine` and over `/`. Its header is pinned to the top of the sheet (`shrink-0`, closed by a single 1px rule — deliberately **not** the double rule the record bands wear) and the open Close sits in it; everything else — the record of what was asked and answered **and the one open ask below it** — is a single scrolling pane (`min-h-0 flex-1 overflow-y-auto`), kept pinned to the item that just landed with focus placed in the open field. Header and record share one measure: max-w-2xl (672px), padded 16px on the sides (24px from `md`) — 16px inside the header, 24px inside the record — with 20px between record entries. Entries are divided by a 1px rule line across the column; inside one entry the question sits at reading size, its label 16px below that, and its field 6px below the label. Nothing floats over the sheet: no action bar, no floating control, no overlay — every control sits beside the item it belongs to.
- **Session workspace and review deck:** quiz content maxes at 672px (max-w-2xl); the review card at 896px (max-w-3xl) with the confidence bar as the sheet's printed footer; a `md`-and-up item sidebar (w-80) walks the deck, collapsing to the footer's prev/next controls below `md`.
- **Spacing rhythm:** a 4px base rhythm; page margin 2rem (`--spacing-margin-page`), gutters 1.5rem (`--spacing-gutter`); sheet cards pad 20px with a 32px left margin reserved for punch holes.
- **Boundary of the system:** slide content inside the session workspace is LLM-authored material rendered in a sandboxed iframe (`components/sandbox/sandbox-frame.tsx`, which re-serves `public/palette.css` cross-origin; the app's theme is handed to it as a `?theme=` param so slides match the palette, #78). It is the learner's lesson, not app chrome — the design system governs the frame around it, never the content inside it.

## Elevation & Depth

Depth is the press of paper on a desk, never ambient glow. Sheets carry a two-part contact shadow (`--shadow-sheet`): a hard 1px edge line in the rule color, then a tight dark drop with a small blur. There are no large diffuse shadows, no glass, no color-wash gradients anywhere.

On the plain form, depth is **tonal, not cast**. The Session intake sheet is full-bleed on the ground and casts nothing: its own edge is only the shared dialog's hairline ring (`ring-1 ring-foreground/10`). What gives it depth is one tonal step — every field sits *above* the ground it rests on, in both renditions: `--surface-container-lowest` on `--surface` (paper #fffaf0 on press paper #f8f2e6 by day, lit sheet #312a21 on the warm desk #1d1813 at night). The sheet's single action button is the only thing on it wearing `--shadow-sheet`, and it wears it because it is the ink block.

### Shadow Vocabulary
- **Sheet rest** (`box-shadow: 0 1px 0 <outline-variant 80%>, 0 2px 5px -2px <black 45%>`; light: `0 1px 0 <outline-variant 90%>, 0 2px 5px -2px <ink 22%>`): the default state of every sheet card and the ink-block CTA — the sheet's edge contact.
- **Sheet raised** (`box-shadow: 0 2px 0 <outline-variant 90%>, 0 8px 18px -6px <black 55%>`; light: with the drop tinted in ink instead of black): hover/attention state, paired with a −1px translate. Exactly one step of lift; there is no third level.

**The Sheet-Contact Rule.** Every lifted thing shows its edge. A shadow is always a contact line plus a tight drop; anything diffuse, wide, or colored is outside this world. A surface that lifts nothing — the plain form — says so with tone instead, and takes no shadow to look like it has depth.

## Shapes

Form language is a pressed, square-cut form. Radii live on a short scale and hard-cap at 8px (`--radius-2xl`/`3xl`/`4xl` all collapse to 0.5rem in `app/globals.css`): sheet cards are gently cut at 6px (`rounded-lg`), option boxes, fields, and textareas at 4px (`rounded-md`), stamps, chips, and compact controls at a hard 3px, full rounding belongs exclusively to bubbles and punch holes (`rounded-full`). Dashes mean *not yet*: dashed outlines mark the blank writing area on the empty sheet and the ahead-steps of the progress rail; solid rules mark what has been walked.

The one surface with no silhouette of its own is the Session intake sheet. It is full-bleed on the ground — no corners, no punch holes, no ruled header strip, no identity edge — because it is not a filed sheet; it is the sheet being filled. Everything inside it takes the standard cuts: 4px fields and option rows (`rounded-md`), 2px under the highlighter line (`rounded-sm`), 6px for the sheet's action button (`rounded-lg`, the shared control's cut). Its only dividing marks are hairline 1px rules across the record column.

Recurring geometry: the double rule (`double-rule-b` — a 1px border with a hairline echo 3px below) closes the record header bands and the top bar; the intake sheet's header is closed by a single 1px rule instead, because a form you are still writing in is not a closed band. The ruled-paper utility prints 32px form lines where a form area is still drawn blank — today that is the empty sheet's writing area (`components/empty-state.tsx`); the intake sheet stopped drawing it, and the utility remains available to any surface that wants a ruled writing area. The punch-hole margin (three small circle holes along the left edge) marks anything that is a filed sheet; stamps draw their inner border as an inset ring tinted from their own ink (`inset 0 0 0 1px currentColor 35%`), and are rotated −2° at rest — rotation is this world's native device for a pressed stamp, not a defect.

## Components

### Buttons
- **Shape:** nearly square; 4px radius for the page-level ink block, 3px for stamp-style controls.
- **Primary ("ink block"):** solid print ink, paper-white text at 15px semibold, 12px×20px padding, resting at sheet contact and lifting −1px to `--shadow-sheet-raised` on hover. It is the one control on a surface allowed to look heavy, and each surface carries exactly one: the History page's `StartSessionButton` (4px cut), or — on the Session intake sheet — the sheet's own action (`Send`, `Approve plan`, `Confirm`, `Back to my sessions`) through the shared `Button` primitive at 6px, `px-4 py-2.5`, sentence case, its meaning carried by a leading glyph. Neither wears monospace caps: the ink block is a sentence, not a form key.
- **Outline control (shared `Button` variant):** 1px rule on the desk's own fill (`bg-background` + `border-border`); on the intake sheet this is the secondary action ("Update plan") and it reads as the same outlined row the open choices use. **Outline stamp controls** elsewhere: 3px corners, 2px border, mono-caps label, hover fills the block. Color follows what the control does: navigation-back prints in ink; **REVEAL** prints in engagement blue (its blue border/text, hover fills blue with paper text) because revealing is an interaction, not navigation.
- **Confidence controls (AGAIN / HARD / GOOD / EASY):** sheet-white chips, 3px corners, mono caps, and a 3px top rule that *is* the scale — riso pink-red (a recorded lapse) → pencil → ink container → filled ink. No green appears in the scale: verified green belongs to outcomes, never to self-reported confidence. Hover adopts its own rung color. They disable while a recording is in flight; a failed recording keeps the card on screen.

**The One Ink Block Rule.** Each page or sheet carries exactly one heavy solid-ink primary CTA; everything else is an outline, a chip, or a plain link. It is set in the body face at 15px, sentence case — the ink block is a sentence, not a form key.

### Option Boxes (quiz / review deck)
- **Style:** sheet-white boxes with a 1px rule border and a printed letter square (JetBrains Mono bold, 3px corners) — exactly like a printed question. Hover shifts the border to engagement blue (the interaction ink). The letter square belongs to the surfaces that print questions; the Session intake sheet's boundary checks are plain full-width option rows instead (see **Session Intake Sheet**), and both treatments are current.
- **Revealed states:** correct → green letter square and green field at 50%; wrong pick → pink-red letter square, correction field, and the PenCross: two hand-drawn red strokes that ink in sequentially (320ms, second +140ms), never an icon with a dash trick; unreached options fade to 45% opacity. The explanation panel below is sheet-white with a 2px colored top rule matching the verdict (pink-red / green / rule-strong).

### Sheet Cards (history, review deck, empty state)
- **Corner Style:** 6px. **Background:** Paper White on the page ground. **Border:** 1px rule. **Internal padding:** 20px, with a 32px left margin reserved for the punch-hole strip.
- **Identity edge:** every history card carries a 5px full-height color press on its left edge in its inquiry's spot (`var(--inq-*)` via `inquiryInk`) — History reads as a color-coded map. The spot is identity only; it never carries verdict meaning.
- **Ritual:** a ruled header strip carries the red monospace "No." and, right-aligned, a mono timestamp; the goal title sets below in Archivo 600. Cards land with `sheet-settle` on first paint and lift one step on hover.
- **Product rule #46:** session cards carry **no stage vocabulary**. The only in-progress signal is a quiet pencil note (mono, "generating…") while materials are produced. Phase is chrome for the session workspace, never a label on a history card.
- **Empty state:** a blank sheet waiting for its first entry — empty "No. ____" slot, printed instructions, a dashed ruled-paper writing area, and the page's one ink block at the foot.

### Stamps (PhaseIndicator)
- **Style:** a square, −2° rotated, double-outlined (inset currentColor ring) monospace-caps chip with a 14px glyph icon, pressed in with `stamp-press`. Work-in-progress phases (clarifying, probing, planning, reviewing, generating) wear an engagement-blue **dashed** outline; executing is a filled engagement-blue block; complete is the green stamp; error is the pink-red stamp; the no-session "ready" state is a pencil dashed stamp. The device belongs to the live session workspace (`views/session.tsx`), where it is the phase chip in the header band and in the status panels; the same press appears there as a 64px bordered square in a success state (`components/state-panel.tsx`). It no longer appears on the intake sheet — an approved plan is approved by a control, not stamped.

### Progress Rail and Bubbles
- **Rail:** a printed row of four bubbles and mono-caps step labels under a double rule on sheet stock. Done steps link with a solid 2px ink rule; ahead steps link with a dashed rule. Step counters appear only under the active step: the clarifying counter numbers the questions in the current round, while the probing counter numbers every question the intake has put on screen, so it carries across probe batches — a second batch of three opens at 4 of 6, not 1 of 3 (#137). The component is unchanged and still exported (`components/progress-rail.tsx`); since the intake sheet stopped drawing it, no shipped surface renders the row today, and a surface that needs to say where the reader stands may say it in words instead (see **Session Intake Sheet**).
- **Bubble:** 14px circles, four states only — empty (outline-variant), filled (done: inks in with `bubble-fill`, solid print ink), current (being worked: engagement-blue ring with a breathing blue dot), active (the place you are standing: filled engagement blue). The bubble is the world's sole progress device wherever progress is drawn; it is live chrome today in the top-bar tabs, and there are still no bars, rings, or percentages anywhere.

**The Bubble-Only Progress Rule.** Where the system draws progress it is a row of bubbles in four states only — empty, filled, current, active. There are no bars, rings, or percentage meters. A surface the learner is filling in states position in a sentence of text instead, which is not a meter and not a second progress device.

### Navigation (TopBar tabs)
- Mono-caps tabs (JetBrains Mono, +0.12em tracking) with a bubble marker: the active tab prints in engagement blue with a filled-blue bubble and `aria-current="page"`; inactive tabs sit in pencil meta and lighten to surface on hover. Active state is derived from the route, and the tabs shrink below `md` rather than hide.

### Session Sidebar
- Item cards walk the deck; each step group opens with a filled number block printed in the inquiry's identity spot (`var(--inq-*)`, `--on-inq` text, 3px corners) beside its mono-caps summary and a dashed rule. Inactive cards sit at a 1px half-rule border; the active card is outlined 2px in print ink and lifted to `--shadow-sheet-raised`. The summary is the rail's line most likely to clip (a 320px rail, a sentence for a title), so it carries a tooltip when it does — see **Tooltips**.

### Slide regeneration (asking for one slide back)
- **Where:** the top-right corner of the slide area, over the player frame itself — the ask is about the slide on screen, so the control sits on the slide, not in the header band. It is offered on a slide and on nothing else: never on a question, and never while the deck is still `generating` (the whole-deck write owns that phase). A control that floats over a rendered surface is opaque where it lands: `--surface-container-lowest` fill on the compact-control cut (3px corners, 1px rule).
- **Two states, one box.** Idle is the square with a refresh glyph in pencil ink, lightening on hover; while that slide is being rewritten the same box is a spinner pressed in engagement blue — the activity ink, the one the phase stamp uses for work in progress — carrying `role="status"`, and it is deliberately **not a disabled button**: browsers suppress pointer events on disabled controls, so the one state that needs an explanation would be the one state that never gives it. Both states explain themselves through `title` and `aria-label` together, the channel the phase stamp already uses: hover says "this slide is being generated", and the same sentence is in the accessible name. The in-flight box cannot be pressed, because the backend refuses a second rewrite of a slide already marked — refusing it in the API and in the chrome is one rule, not two.
- **Pressing it never regenerates.** It opens the ask, printed as the app's own dialog sheet — paper fill, a ring, a header and a footer, the structure the sign-in modal and the account-name dialog use: one labelled textarea, then Cancel / **REGENERATE**. The text is the whole request; leaving the box empty is a real request ("write this slide again"), sent as *nothing* rather than as an empty string. The note belongs to one slide and one ask — a fresh sheet per slide, so what was written about slide 2 is never sent for slide 3 — and a refusal is printed in the sheet that asked, in error mono as a `role="alert"`: the backend's own sentence where it has one (this slide predates stored specs — regenerate the deck), the app's own words where it has none. A refusal that means the rewrite is *already running* is not a message at all: the deck is re-read, and the loading state is what the reader is shown. A Visitor's press asks for sign-in instead (ADR-0006: this is a gated write).
- **The rewritten slide reaches the reader as a slide, not as a badge.** The deck read carries `regenerating` per slide; while any slide carries it, the deck is polled, and the *falling edge* of that flag is what re-keys the player frame's URL with a `fresh=` nonce — a rewritten slide keeps its ID, and a frame re-importing the URL it already fetched gets the browser's copy of the old bytes. The re-key lands the reader back on the item they were on, in the palette they were using, through the same `load` / `SANDBOX_READY` resync as any other frame build. The sidebar's mini preview of the same slide re-fetches on its own `fresh=` nonce — it is a separate document the player's re-key never reaches, and the rail must not keep showing the version the reader asked to be replaced. A theme change never re-keys either: theme still travels as `DEMO_SET_THEME` (#185).

### Tooltips (a clipped line printed in full)
- **Where:** the lines that can hold text the surface has no room for — a session goal in a deck header band, a step summary in the item rail. A clipped line ends in an ellipsis, and the ellipsis is what the reader hovers. (A line that is showing all of its text raises nothing: a tooltip repeating what the surface already printed is noise. Fixed lines like the rail's `SLIDE`/`QUIZ` labels hold catalog copy, never learner text.)
- **Sheet:** a small printed slip — paper-white fill (`--surface-container-lowest`), a 1px rule (`--outline-variant`), 3px corners (the cut stamps and chips wear), the sheet's contact shadow (`--shadow-sheet`), no arrow, no glow, both renditions from the same role tokens. It is not browser chrome.
- **Voice:** the slip carries the clipped line's own rung — the deck header's Archivo title, the rail's mono-caps label — never a voice of its own, and never pencil meta. This is not the Printed-Form or Mono-Vocabulary rule being bent: the slip introduces no new copy in a face, it re-prints the line's own copy so the reader can see that the ellipsis and the full text are one thing. A *note* in this system stays what it always was — 14px pencil meta (the Meta rung; `state-panel`, list headers); a slip is the line itself, continued.
- **Placement:** centred under the line it annotates — the trigger is the line, not the band around it — and capped at whichever measure is smallest: that line's width, 36rem (inside the 65–75ch column the system sets copy at), or the space on screen. It is portalled out of the pane, because the panes clip their own overflow.
- **Life:** up exactly while the pointer rests on the clipped line, and nothing else — one open per surface, dismissed by the line's own pointer-leave, by Escape, or by a click. The slip takes no pointer events itself: it must not swallow a click meant for the deck under it, and a deck whose slide is a cross-origin iframe is precisely where a hover-tracking grace area loses sight of the pointer. Raising it waits 150ms of real hover intent, not Radix's 700ms. The clipped text stays in the DOM, so nothing is hidden from a screen reader, and the same title is printed in full in its own row on every History and Explore card — which is where a touch reader reads it, since hover is a pointer affordance.

### Session Intake Sheet (the plain form)
The surface a learner goes through to turn "I want to learn X" into an approved plan (`views/mine/new-session-dialog.tsx`, state core in `views/mine/intake.ts`, binding in `views/mine/use-session-intake.ts`). It is a form, not a conversation, and the record of the intake **is** the sheet — not a log beside it.

- **Header.** The title at 20px semibold in the body face, sentence case; beneath it the learner's position stated as a sentence of text in the app's own copy at 14px pencil meta ("3 steps to your lesson" → "2 steps…" → "1 step to your lesson" → "Approve to build your lesson" → "Your lesson is on the way"), announced as `role="status"`; one Close control at the right (32px square, 4px cut, hover fills `--accent`, disabled while a request is in flight). No rail, no meter, no stamp, no caps: **position is a sentence here, never a meter.**
- **The record.** Everything asked and answered, in order, in one column, entries divided by a 1px rule line. The app's question sits at 15px in pencil meta above the answer it produced; the learner's answer sits in a **filled container** (14px semibold label — "Your answer", "What you asked to learn" — then 15px ink text, 68ch measure, paper fill, 1px rule, 4px cut, `12px 16px` padding). Multi-line answers become a bulleted list. The narrowed goal the app echoes back is the one line on the sheet wearing the highlighter wash. An answered boundary check keeps its question, the chosen option in its filled container, the verdict caption at 14px semibold ("Correct." in verified green / "Not quite." in correction pink-red) and the explanation at 14px meta under "Why:". A statement that asks nothing is a note at 15px pencil meta. An adjustment replaces the plan above it rather than adding a second one.
- **The one open ask.** Exactly one thing is open at a time, below the record, in the same scrolling pane. A words ask labels its own field — the question at 15px semibold, the position line at 14px beneath it, then a full-column textarea at 15px (16px padding, paper fill, 1px rule, 4px cut) whose focus takes the interaction treatment. A choice ask is a `fieldset` whose legend is the question and whose options are **outlined rows**: full width, 15px text, `12px 16px` padding, 1px rule, no fill, no leading marker, blue border on hover, blue `focus-ring`; pressing a row *is* the answer — there is no second submit step. The distinction between a filled container and an outlined row is the only state device this sheet has (see **The One State Device Rule**).
- **Plan review.** The plan arrives as a numbered list. Its summary at 15px semibold; each step numbered in a fixed 20px right-aligned column at 15px semibold pencil meta with tabular numerals, the step title at 15px semibold ink, its description at 15px pencil meta, and "Builds on: <step>" at 14px. Plan numbers are **not** engagement blue — this surface uses the blue only where something is being interacted with.
- **Actions sit beside the item they belong to.** `Send` is the sheet's ink block, disabled while a field that wants words is empty: an empty field is not an answer, so the sheet never sends one and never answers "something went wrong" to a learner who pressed Send on nothing. In plan review the pair is `Update plan` (the shared outline control — the desk's own fill and a 1px rule, inert until something is typed) beside `Approve plan` (the ink block, which sends the approval itself; the learner never has to type a word in a language they may not be reading the form in). No floating action bar, ever.
- **In flight, refused, on the way.** While a request runs, the open ask's control is replaced by a 14px pencil line saying what is happening, with a spinner and `role="status"`. A refusal prints in the item that asked, at 14px in the correction ink as a live region. After approval the sheet keeps its record on screen and adds one filled container: a verified-green sentence, and the one action that files the session.
- **What this sheet does not use.** Ruled paper, stamps, bubbles or any meter, lettered option boxes, monospace caps, the display face, left-ruled chat bubbles, an APPROVED stamp. Each of those remains native to the surfaces that still use them; this is a surface boundary, not a system ban.
- **Its motion.** None of the three authored press moments appears here. The sheet's motion is the shared dialog open (100ms fade + zoom-in-95), colour transitions on rows and fields, the ink block's one-step lift, the spinner while a request runs, and the record pane keeping itself pinned to the item that just landed with focus placed in the open field. Under `prefers-reduced-motion` everything on the sheet is still understood: no state is carried by motion.

### Form Surfaces
- **Focus (custom controls, buttons, links, cards):** `focus-ring` — a 2px outline in `--ring`, which is engagement blue in both themes, offset 2px (focus is interaction, and interaction belongs to the blue). shadcn primitives carry their own rings. Native text fields split by surface, and both treatments are current: the intake sheet's open field takes the interaction ink (`focus-visible:border-engage` plus a 2px `engage/25` ring), while the sign-in form, the account-name dialog, and the regenerate-slide sheet still use a soft ink-tinted ring (`ring-primary/25` at 2px).

### The Halftone Screen (where the press shows)
- A field of dots in the current text color (`halftone` — radial dots on a 7px screen) names the riso press. The build prints it in exactly two places: behind the CTA end of the record header band (engagement blue at 13% opacity, `md` and up) and beside the login sheet's wordmark (blue at 25%, 40px square). It is a signature accent, not a required decoration; nothing else wears it.

### The Motion Grammar (signature behavior)
Three authored moments, used consistently, never scattered — `bubble-fill` (200ms), `stamp-press` (220ms, settles from scale 1.08/−4° to rest at −2°), `sheet-settle` (240ms, 6px rise) — plus the two pen strokes and the breathing dot. All share one easing, `cubic-bezier(0.16, 1, 0.3, 1)`, exponential ease-out from an already-visible default. Under `prefers-reduced-motion: reduce` every authored animation is switched off; nothing in the flow depends on motion to be understood.

These moments belong to the surfaces that print: bubbles inking in, stamps pressing, sheets settling onto the desk. The Session intake sheet carries none of them — a form the learner is filling in moves only when the reader makes it move (see **Session Intake Sheet → Its motion**).

## Do's and Don'ts

### Do:
- **Do** keep every color inside its press role: ink structures, the engagement blue only marks activity and interaction (focus, current, running, active nav, reveal, an open row's hover), pink-red only corrects, green only verifies, pencil only annotates.
- **Do** give each inquiry its spot from `inquiryInk` and use it only as identity — sheet-card edge and sidebar step blocks.
- **Do** mark progress with bubbles only — empty, filled, current, active — and connect walked steps with solid ink rules, ahead steps with dashed ones.
- **Do** set phase as a stamp: rotated −2°, double-outlined, monospace caps, pressed in; blue while working, green when complete, pink-red on error.
- **Do** file every **filed card** the same way — history, review, and empty-state cards: punch-hole margin, ruled header strip, red monospace "No.", 6px corners, sheet-contact shadow. The intake sheet is not a filed card; it is the sheet being filled.
- **Do** run a surface the learner fills in as a plain form: one column (max-w-2xl, copy held to 68ch), 20px title / 15px reading text / 14px labels and meta, sentence case, actions beside the item they belong to.
- **Do** keep the filled-versus-outlined distinction as the only state device on a form sheet: filled paper (`--surface-container-lowest`, 1px rule) for what is already recorded, an outlined full-width row for what is still waiting to be pressed.
- **Do** say where the learner is in words on a surface being filled in ("3 steps to your lesson", "Approve to build your lesson"). Bubbles are how the system draws progress; they are not the only way position may be stated.
- **Do** give each page or sheet exactly one ink block — the heavy solid-ink primary CTA — and set it in the body face at 15px, sentence case.
- **Do** use the highlighter wash (`--marker`) on the learner's own narrowed goal on the intake sheet, and there only.
- **Do** keep type legible at any age in both scripts: Source Sans 3 body at 15px with the 14px meta rung beneath it, uppercase Archivo only for record header bands, mono only for codes, counters, and form keys on the surfaces that print in that voice.
- **Do** ship every surface in both renditions — riso paper and night desk — from the same role tokens, fields kept one step above the ground.

### Don't:
- **Don't** use pink-red on anything that succeeded, or green on anything unverified (including the confidence scale).
- **Don't** assign the correction pink-red or the verified green as an inquiry identity spot; the fan is blue / flame / violet / ochre.
- **Don't** use the engagement blue on anything static or structural — headings, sheet bodies, completed bubbles, plan numbers stay out of it.
- **Don't** put stage or phase vocabulary on session cards (product decision #46).
- **Don't** dress the Session intake sheet in the record devices: ruled paper, stamps, bubbles, lettered option boxes, monospace caps, the display face, or left-ruled chat bubbles. Each stays native to the surfaces that still use it.
- **Don't** put a meter where a sentence will do, or a marker on a row whose only state is "press me".
- **Don't** round form surfaces past 8px; full circles are reserved for bubbles and punch holes.
- **Don't** use glow, color-wash gradients, glass, or diffuse ambient shadows anywhere — depth is contact plus a tight drop, or one tonal step between ground and field; the halftone dot screen is a dot screen, not a gradient wash.
- **Don't** use progress bars, rings, or percentage meters; where the system draws progress, the bubble row is the device.
- **Don't** treat LLM-authored slide content in the sandbox iframe as app chrome; the system frames it, never styles it from outside.
- **Don't** invent a second highlighter, a fifth inquiry ink, or a decorative color; the press has its quota.
