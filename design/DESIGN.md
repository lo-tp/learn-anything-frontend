---
name: Electric Vivid Modern
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#00687a'
  on-secondary: '#ffffff'
  secondary-container: '#57dffe'
  on-secondary-container: '#006172'
  tertiary: '#632ecd'
  on-tertiary: '#ffffff'
  tertiary-container: '#7d4ce7'
  on-tertiary-container: '#f6edff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#e9ddff'
  tertiary-fixed-dim: '#d0bcff'
  on-tertiary-fixed: '#23005c'
  on-tertiary-fixed-variant: '#5516be'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
typography:
  display-hero:
    fontFamily: Space Grotesk
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
  display-hero-mobile:
    fontFamily: Space Grotesk
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '600'
    lineHeight: 48px
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-code:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system establishes an ultra-modern, luminous aesthetic tailored for next-generation AI and technical learning environments. It merges the surgical clarity of high-performance developer tools with the inviting, kinetic energy of modern creative software.

The visual direction centers on an electrified balance: crisp optical whites, subtle cool-tinted canvas backdrops, sharp geometric typographic hierarchy, and saturated blue focal points that pulse with computational energy. The emotional target is high-velocity comprehension, technological empowerment, and calm clarity under dense data loads.

## Colors

The palette balances intense kinetic energy against a crystalline, low-strain surface infrastructure. 

### Palette Roles & Application
- **Primary (`#2563EB`)**: High-energy electric blue. Drives direct visual actions, active navigation anchors, progression rings, and key callouts.
- **Secondary (`#06B6D4`)**: Vivid electric cyan. Serves as a complementary signal for interactive data states, code syntax accents, and real-time generation indicators.
- **Tertiary (`#8B5CF6`)**: Electric violet. Reserved for AI-assisted operations, generative intelligence tags, and specialized learning milestones.
- **Neutral (`#0F172A`)**: Deep slate obsidian. Delivers optimal contrast for typography and structured structural borders without pure black harshness.

### Tint & Surface Tokens
- **Canvas Base**: `#F8FAFC` (Cool porcelain tint, reduces optical fatigue).
- **Surface Elevation (Cards & Panels)**: `#FFFFFF` (Pure crisp white to achieve distinct spatial popping).
- **Subtle Surface Tint**: `#EFF6FF` (Ultra-low opacity electric blue wash for active selection states and code blocks).
- **Border Crisp**: `#E2E8F0` (Architectural boundary lines with 1px precision).

## Typography

The typographic hierarchy combines three distinct geometric and technical voices to balance editorial rhythm and code readability.

### Type Pairings & Behavioral Directives
- **Headlines (`Space Grotesk`)**: Provides an authoritative, tech-forward cadence with distinct geometric apertures. Applied with tight tracking (-0.02em) on sizes above 28px.
- **Body (`Hanken Grotesk`)**: Ensures rapid scanning, neutral warmth, and high legibility across variable light environments. Letter spacing remains neutral (`0`).
- **Code, Metrics & Data Chips (`JetBrains Mono`)**: High-contrast, tabular monospacing designed for code snippets, model telemetry, parameter configurations, and dynamic keyboard shortcuts.
- **Micro-labels (`label-caps`)**: Styled strictly with uppercase treatment and widened letter spacing (+0.08em) for metadata categories and section dividers.

## Layout & Spacing

The layout is built on an adaptive 12-column responsive fluid grid anchored by a predictable 4px/8px incremental rhythm.

### Breakpoints & Layout Adaptations
- **Desktop (1280px+)**: 12-column grid, max content bounds capped at 1440px with `margin: 2rem` and `gutter: 1.5rem`. Split-screen workspaces (e.g., interactive prompt console alongside live documentation) split 5:7 or 6:6.
- **Tablet (768px - 1279px)**: 8-column layout with 1.25rem gutters. Sidebars collapse to icon-only navigation docks or sliding overlays.
- **Mobile (<768px)**: 4-column structure with `margin-mobile: 1rem` and `gutter-mobile: 1rem`. Multi-pane AI workflows automatically stack into swipeable tabs or vertical sequential feeds.

### Rhythm Principles
- Component interior padding relies on `space-md` (16px) for compact widgets and `space-lg` (24px) for prominent instructional cards.
- Vertical layout sections maintain a minimum separation of `space-xl` (40px) to sustain spatial breathability and visual cadence.

## Elevation & Depth

This system avoids dark or muddy dropshadows in favor of ethereal, ambient blue-tinted diffusion and crisp structural borders. 

### The Stacking Architecture
1. **Level 0 (Backdrop Canvas)**: `#F8FAFC`. Completely flat; anchors global layouts.
2. **Level 1 (Card & Module Surface)**: Pure `#FFFFFF` resting on a 1px perimeter border of `#E2E8F0`. Soft ambient diffusion: `0 4px 20px -2px rgba(37, 99, 235, 0.04)`.
3. **Level 2 (Hover & Active Overlays)**: Surface lifts via subtle negative translation (`-2px`) combined with dual ambient glows: `0 10px 25px -3px rgba(37, 99, 235, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.02)`.
4. **Level 3 (Modals & Command Palettes)**: Floating white modules wrapped with a luminous border: `1px solid rgba(37, 99, 235, 0.20)`. Backed by an ultra-soft glass backdrop: `backdrop-filter: blur(12px); background-color: rgba(248, 250, 252, 0.8)`. Shadow: `0 20px 40px -12px rgba(15, 23, 42, 0.12)`.

## Shapes

The geometry utilizes a rounded profile (Level 2) that softens technical learning tools while retaining professional architectural rigor.

### Rounding Scale
- **Base Components (`0.5rem` / `8px`)**: Input controls, button variants, interactive tabs, standard table rows, and status badges.
- **Container Elements (`rounded-lg` - `1rem` / `16px`)**: Learning lesson modules, code console windows, and interactive challenge canvases.
- **Structural Wrappers (`rounded-xl` - `1.5rem` / `24px`)**: Hero breakout containers, modal overlays, contextual drawers, and major dashboard widget groupings.
- **Pill Formats (`9999px`)**: System chips, tag selectors, and inline status indicator nodes.

## Components

### Buttons
- **Primary**: Solid electric blue (`#2563EB`) with crisp white text. Elevated with an ambient blue shadow (`0 4px 14px 0 rgba(37, 99, 235, 0.35)`). Active state shifts to dynamic blue shade (`#1D4ED8`).
- **Secondary**: Crisp white container with 1px border (`#E2E8F0`) and `#0F172A` text. On hover, background shifts to `#EFF6FF` with a border transition to `#2563EB`.
- **Tertiary / Ghost**: Transparent fill, `#2563EB` text, with instantaneous `#EFF6FF` wash on interaction.

### Cards & Learning Tiles
- Pure white background framed in 1px `#E2E8F0`. 
- Incorporates `rounded-lg` for nested child cards and `rounded-xl` for top-level structural containers.
- Interactive cards feature a hidden top border highlight (2px `#2563EB`) that transitions smoothly into view on hover.

### Chips & Badges
- **Skill / Model Chips**: Fully pill-shaped (`9999px`), `JetBrains Mono` font for metric/tag accuracy, using `#EFF6FF` surface with `#2563EB` text and a subtle 1px border in `rgba(37, 99, 235, 0.2)`.
- **AI Indicator Chips**: Saturated linear gradient border (`#2563EB` to `#8B5CF6`) with clean white interior and tertiary electric purple accents.

### Form Inputs & Prompts
- Background: `#FFFFFF`. Border: 1.5px `#E2E8F0`.
- Focus state switches border instantly to `#2563EB` paired with an electric focus ring: `box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12)`.
- Monospace prompt inputs apply `JetBrains Mono` at `14px` with a subtle vertical caret glow.

### Selection Controls (Checkboxes & Radios)
- Base: Crisp white box with 1.5px `#CBD5E1` border, `rounded` for checkboxes (4px) and full circles for radios.
- Checked State: Saturated `#2563EB` fill with a sharp white checkmark or center pin.

### Specialized Tech Learning Components
- **Code Sandbox Panes**: Cool slate headers (`#F1F5F9`) atop pure white editor canvases, finished with 1px structural dividing borders and electric blue active-line badges.
- **Progress Trackers**: Segmented multi-step paths carrying continuous neon-blue line states for completed sections, subtle muted slate for pending states, and an animated radial pulse for current objectives.