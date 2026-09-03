# Slide-deck material: ReMotion or pure markdown; reveal.js and SlidesV are out

Spike #28 (PPT-like material for course content) closed with the candidate list narrowed to two: **ReMotion** (programmatic, React-native rendering — slides as React components, video/PDF export) or **pure markdown** (slides authored as markdown, in the spirit of the progress markdown as a projection, ADR 0001). The final pick between the two is deferred to the ticket that builds the feature; both fit the existing Next.js/React stack.

**Considered options:**

- **reveal.js** — dropped: a standalone HTML presentation framework; everything we'd need from it is already covered by the two remaining options.
- **SlidesV** — dropped: Vue/Vite-based, a framework mismatch with the repo's Next.js/React stack.
