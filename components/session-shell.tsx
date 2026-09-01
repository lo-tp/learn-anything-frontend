import { createHighlighter } from "shiki";
import { ChatSidebar } from "@/components/chat-sidebar";
import { DocumentPane } from "@/components/document-pane";

/**
 * Placeholder progress document. The real document pane renders the
 * session's folded state via `core/markdown` (later tickets on map
 * #11); until then this sample stands in for the design shell.
 */
const SAMPLE_DOCUMENT = `# Newton's second law of motion

*Stage: executing — 2 of 4 steps passed*

## Plan (revision 1)

- [x] What a force is
- [x] What mass measures
- [ ] What acceleration means
- [ ] F = ma, put together

## Question log

### What a force is — passed

> **Q:** What does “force” mean in physics?
>
> **You:** A push or pull that changes an object's motion
>
> **Result:** Passed on the first try.

### What mass measures — passed after re-test

> **Q:** True or false: a heavier object has *less* mass.
>
> **You:** True — *wrong*
>
> **Why:** Mass measures how much matter is in an object, so a heavier
> object has *more* mass, not less.
>
> **Re-test:** True or false: mass is measured in kilograms. → **Passed**

## Worked example

\`\`\`typescript
// F = m * a
const mass = 2;         // kg
const acceleration = 3;  // m/s^2
const force = mass * acceleration; // 6 N
\`\`\`
`;

/**
 * The placeholder session view: chat sidebar + document pane. Stands in
 * for the real session page (later tickets on map #11). Mounted by `/demo`
 * until then; the shared frame is applied by the root layout.
 */
export async function SessionShell() {
  const highlighter = await createHighlighter({
    themes: ["dark-plus"],
    langs: ["typescript"],
  });

  return (
    <main className="flex flex-1 overflow-hidden">
      <ChatSidebar />
      <DocumentPane markdown={SAMPLE_DOCUMENT} highlighter={highlighter} />
    </main>
  );
}
