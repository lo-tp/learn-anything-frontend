# Writing math notation with the MathText component

`MathText` is a React component that renders a plain-text string with embedded LaTeX as native MathML. Use it for any user-facing text that may contain math, so the same field handles both plain prose and math alike.

## Component API

```tsx
import { MathText } from "@/components/math-text";

<MathText content="If $a = b$ and $b = c$, then $a = c$." />
```

- `content: string` (required) — the text to render, with math wrapped in delimiters.
- `className?: string` (optional) — applied to the wrapping `<span>`.

## How the `content` string works

`content` is **plain text plus math delimiters**. The renderer is a KaTeX-compatible LaTeX-to-MathML engine: it scans the string and converts the delimited math in place, emitting everything else as literal text.

- **Inline math** — single `$…$`. Stays on the line. `$x^2 + y^2 = z^2$`
- **Display math** — double `$$…$$`. Renders as a centered block (block-level, even inside the inline wrapper). `$$E = mc^2$$`
- **Plain prose** — anything outside the delimiters renders exactly as typed, with no markup.

## Supported notation

The engine is KaTeX-level, so standard LaTeX notation works. (The backslashes below show the characters that must end up in the `content` value — see the escaping note in Gotchas for how to write them in code.)

- Fractions: `\frac{a}{b}`, `\dfrac{a}{b}`
- Roots: `\sqrt{x}`, `\sqrt[n]{x}`
- Sub/superscripts: `x^2`, `x_i`, `a_{ij}`
- Sums and integrals: `\sum_{i=1}^{n}`, `\int_{a}^{b} f(x)\,dx`
- Greek letters: `\alpha`, `\beta`, `\theta`, `\pi`
- Operators and relations: `\times`, `\cdot`, `\pm`, `\leq`, `\geq`, `\approx`
- Upright text inside math: `\text{...}`

When in doubt, write the notation the way you would write it in KaTeX.

## Gotchas

- **`content` is plain text, not HTML.** Tags render literally — `<b>x</b>` shows the characters, it does not bold. Use LaTeX for math emphasis, not markup.
- **`$` is the math delimiter, so keep it balanced.** A stray `$` pairs with the *next* `$` and treats the text between them as math. Prefer words for currency (`five dollars`) over a literal `$`.
- **Escape backslashes in code.** A LaTeX backslash must survive the string/JSX escape layer. In a JS string or a JSX attribute, write a double backslash — `content="$$A = \\pi r^2$$"` — so the string value holds the single-backslash `\pi`. A single `\` in code gets consumed or dropped and the symbol won't render.
- **Malformed LaTeX does not throw** — it degrades to the raw source text. A typo won't crash, but it will display un-rendered LaTeX. Check the output renders as math (MathML), not raw `$`.

## Examples

```tsx
// Inline math in a question
<MathText content="Solve for $x$: $\frac{x}{2} = 5$." />

// Display math — a standalone equation, rendered as a block
<MathText content="The area of a circle is $$A = \\pi r^2$$." />

// Mixed prose and math
<MathText content="By the Pythagorean theorem, $a^2 + b^2 = c^2$." />
```
