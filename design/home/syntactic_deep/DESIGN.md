---
name: Syntactic Deep
colors:
  surface: '#081425'
  surface-dim: '#081425'
  surface-bright: '#2f3a4c'
  surface-container-lowest: '#040e1f'
  surface-container-low: '#111c2d'
  surface-container: '#152031'
  surface-container-high: '#1f2a3c'
  surface-container-highest: '#2a3548'
  on-surface: '#d8e3fb'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#d8e3fb'
  inverse-on-surface: '#263143'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#bec6e0'
  on-secondary: '#283044'
  secondary-container: '#3f465c'
  on-secondary-container: '#adb4ce'
  tertiary: '#c4c7c9'
  on-tertiary: '#2d3133'
  tertiary-container: '#8e9193'
  on-tertiary-container: '#272a2c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#081425'
  on-background: '#d8e3fb'
  surface-variant: '#2a3548'
typography:
  display:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  code-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  gutter: 1.5rem
  sidebar_width: 320px
  editor_max_width: 840px
  margin-page: 2rem
---

## Brand & Style

The design system is engineered for deep focus and technical precision, catering to developers and technical writers. It prioritizes clarity and executive function, using a **Minimalist** aesthetic with high-density information areas balanced by generous negative space. 

The emotional response should be one of "calm capability"—where the interface recedes into the background to let the user's content and the AI's logic take center stage. Visual interest is generated through precise alignment, intentional color accents, and subtle micro-interactions rather than decorative elements.

## Colors

This design system utilizes a sophisticated **Dark Mode** foundation to reduce eye strain during long sessions.

- **Primary (Indigo):** Used for action states, focus indicators, and AI-driven highlights. It represents intelligence and connectivity.
- **Secondary (Deep Slate):** The primary canvas color. It provides a grounded, stable environment for the editor.
- **Tertiary (Cloud):** Reserved for high-contrast typography and critical iconography.
- **Neutral (Slate):** Used for borders, inactive states, and secondary surfaces like the sidebar and status bars.

Surface levels are defined by subtle shifts in luminosity rather than drastic color changes.

## Typography

The typography system is built on a dual-font strategy: **Geist** for UI and prose content to provide a clean, modern Sans-Serif experience, and **JetBrains Mono** for code blocks, AI meta-information, and UI labels.

High contrast is maintained between body text and backgrounds to ensure maximum readability. For headings, a tight letter spacing is used to create a "locked-in" professional feel. Mobile adjustments are minimal, as the editor is primary a desktop-first tool, but `display` scales down to `24px` on smaller viewports.

## Layout & Spacing

The layout follows a **Fixed-Fluid hybrid model**. 
- **Sidebar (Chat):** A fixed-width left or right sidebar (320px) handles AI interaction.
- **Main Area (Editor):** A fluid container that centers the Markdown document within a max-width of 840px to maintain optimal line lengths for reading.
- **Rhythm:** An 8px grid system governs all internal spacing. Large margins (32px+) are used between major functional blocks to create a "breathable" interface.

On tablet devices, the sidebar transitions to an overlay drawer. On mobile, the interface defaults to a single-column view with a bottom-sheet for the AI chat.

## Elevation & Depth

This design system uses **Tonal Layers** combined with **Ambient Shadows**. 

1. **Level 0 (Background):** Secondary color (#0F172A). Flat.
2. **Level 1 (Sidebar/Secondary Panels):** Neutral color (#1E293B). Used for the chat area and file tree.
3. **Level 2 (Floating Elements/Menus):** Neutral color with a 1px border (#334155) and a soft, diffused shadow (0px 4px 20px rgba(0,0,0, 0.4)).

Shadows are never pure black; they are tinted with the primary or secondary color to ensure they feel integrated into the dark environment.

## Shapes

The shape language is consistently **Rounded (0.5rem)**. This provides a approachable feel to a technical tool without appearing too "bubbly" or informal. 

- Small components (Checkboxes, Tooltips) use `rounded-sm`.
- Standard components (Buttons, Inputs, Cards) use `rounded-md` (0.5rem).
- Large containers (Sidebar modules, AI message bubbles) use `rounded-lg` (1rem).

## Components

- **Buttons:** Primary buttons are solid Indigo with Tertiary text. Ghost buttons use a 1px Slate border and transition to a subtle Indigo glow on hover.
- **AI Chat Bubbles:** AI responses should have a distinct background (Level 1 surface) compared to user prompts (transparent with left-border accent).
- **Input Fields:** Minimalist design with only a bottom border in neutral color, transforming to a full primary outline when focused.
- **Markdown Editor:** Use high-contrast syntax highlighting. Blockquotes and code blocks should have a subtle background tint and 0.5rem corner radius.
- **Chips:** Used for "AI Suggestions" or "Tags," these should be small, mono-spaced, and use a low-opacity Indigo background.
- **Status Bar:** A 24px height bar at the bottom for line counts, language selection, and AI status, using `label-sm` typography.