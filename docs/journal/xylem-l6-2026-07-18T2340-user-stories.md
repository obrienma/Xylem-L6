---
id: xylem-l6-2026-07-18T2340-user-stories
repo: xylem-l6
title: "User Stories Document (docs/USER_STORIES.md)"
date: 2026-07-18
tags: [documentation, actor-modeling, status-taxonomy, scope-discipline, decision-then-implementation, adr-0008]
files:
  - docs/USER_STORIES.md
  - README.md
---

### Pattern: Grounding Every Story in a Real Identifier, Not Just README Prose
Each story cites an actual file (`src/core/window.ts`, `src/sinks/synapse-l4/index.ts`, etc.), env var, or ADR number rather than paraphrasing README's summary language. Before writing, `find src tests -type f` and direct reads of `src/core/types.ts` and `src/index.ts` confirmed exact paths, env var names (`XYLEM_ADAPTER`, `XYLEM_CHECKPOINT_FILE`, `XYLEM_SYNAPSE_L4_ENABLED`), and field names (`sourceIp`, `scopes`, `tenant`) rather than trusting memory of README's prose, which paraphrases rather than quotes those identifiers exactly.

### Decision: New Actor Icons Instead of Reusing Sentinel-L7's Template Verbatim
The pasted structure used 🤖 for "AI agent." Xylem-L6 has no LLM/AI step by explicit design (ADR 0003: "Vertex AI is not used... that stays Sentinel-L7's domain entirely"), so reusing 🤖 for an automated downstream consumer would have implied an AI actor that doesn't exist in this repo. Replaced with 🔌 "downstream pipeline" (Synapse-L4/Sentinel-L7 as an automated consumer) and kept 🕵️ "security analyst" for the human who benefits from the signals one hop downstream, since Xylem-L6 itself has no dashboard of its own to point that persona at directly.

### Decision: Cite the ADR 0003 Non-Goal as Its Own 🚫 Story
Every other 🚫 story in the document names something the codebase used to consider building. The "no LLM step" non-goal is different — it's a standing architectural boundary, not a shelved feature — but it was written as a story anyway ("As a platform engineer evaluating scope creep, I want confirmation...") so the document's own taxonomy stays complete rather than silently omitting the one deferral that isn't feature-shaped.

### Challenge: Classifying a Decided-but-Unbuilt Feature Correctly
ADR 0008's 2026-07-18 addendum (tenant on the Synapse-L4 payload) doesn't fit either status cleanly. It's not ✅ — `src/sinks/synapse-l4/index.ts` doesn't implement it, confirmed by reading the file directly rather than trusting the ADR's own code sketch. It's also not 🚫 — nothing rejected the idea; the ADR actively decided the shape (`...(event.tenant !== undefined && { tenant: event.tenant })`), it just hasn't been coded yet, which is this project's own established decision-then-implementation split (ADR 0004/0005), not a deferral. Marking it ✅ would have overstated what the code does today; marking it 🚫 would have misrepresented a deliberate two-step process as a rejection. It landed as 🔲 with TODO text naming both gaps explicitly: the code doesn't exist here yet, and even once it does, Synapse-L4's own models don't accept the field yet either — so the story's "so that" clause (Sentinel-L7 ADR-0031's passthrough gets a value) stays unmet on two independent fronts, not one.
