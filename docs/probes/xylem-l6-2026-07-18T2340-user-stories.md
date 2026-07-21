---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, decision, actor-modeling]
---
Q: Why wasn't Sentinel-L7's USER_STORIES.md actor icon 🤖 ("AI agent") reused as-is for Xylem-L6's user stories document?

A: Xylem-L6 has no LLM/AI step by explicit architectural decision (ADR 0003: Vertex AI isn't used, that stays Sentinel-L7's domain). Reusing 🤖 for an automated downstream consumer would have implied an AI actor that doesn't exist in this repo, so it was replaced with 🔌 "downstream pipeline" for Synapse-L4/Sentinel-L7 as automated consumers.

Extra: xylem-l6 · Decision: New Actor Icons Instead of Reusing Sentinel-L7's Template Verbatim
See: docs/journal/xylem-l6-2026-07-18T2340-user-stories.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, pattern, documentation]
---
Before drafting each user story, exact file paths and env var names were confirmed via {{c1::`find src tests -type f` and direct reads of `src/core/types.ts`/`src/index.ts`}} rather than trusted from README's paraphrased prose.

Extra: xylem-l6 · Pattern: Grounding Every Story in a Real Identifier, Not Just README Prose
See: docs/journal/xylem-l6-2026-07-18T2340-user-stories.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, challenge, status-taxonomy, adr-0008]
---
Q: Why didn't the ADR 0008 tenant-on-Synapse-L4-payload addendum fit cleanly as either ✅ implemented or 🚫 deferred in the user stories document?

A: It's not ✅ — src/sinks/synapse-l4/index.ts doesn't implement it (confirmed by reading the file, not trusting the ADR's own code sketch). It's also not 🚫 — nothing rejected the idea; the ADR actively decided the exact conditional-spread shape, it just hasn't been coded yet, matching this project's own decision-then-implementation split (ADR 0004/0005) rather than a deferral. It landed as 🔲, with TODO text naming two independent unmet gaps: the code doesn't exist here yet, and even once it does, Synapse-L4's own models don't accept the field yet either.

Extra: xylem-l6 · Challenge: Classifying a Decided-but-Unbuilt Feature Correctly
See: docs/journal/xylem-l6-2026-07-18T2340-user-stories.md
