---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, single-source-of-truth, refactor]
---
Implementing the fusion function moved `VELOCITY_BREACH_THRESHOLD` and `MAX_PLAUSIBLE_SPEED_KMH` out of `index.ts` and into `{{c1::src/core/thresholds.ts}}`, so drift between the demo's console flags and fusion severity normalization becomes a compile-time impossibility rather than a code-review discipline.

Extra: xylem-l6 · Pattern: Making "Single Source of Truth" Mechanical, Not Just Documented
See: docs/journal/xylem-l6-2026-07-17T1630-fusion-function-implementation.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, anti-pattern, scope-discipline]
---
Q: Why wasn't `fuseSignals()` wired into `index.ts`'s console output once it was implemented and working?

A: ADR 0005's own Consequences section already states, as an accepted outcome, that the score payload would have "a defined shape now even though nothing consumes it yet." Wiring it into the console line just because it was now easy to do would have quietly exceeded what ADR 0005 actually authorized — the same temptation existed for ADR 0006's tenant field, where printing it WAS the right call, but the two cases differ: 0006 explicitly wanted an exercised path, 0005 explicitly didn't yet.

Extra: xylem-l6 · Anti-Pattern Avoided: Wiring a New Capability In Just Because It's Now Possible
See: docs/journal/xylem-l6-2026-07-17T1630-fusion-function-implementation.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, fusion-function, normalization]
---
`impossibleTravel` severity is computed as `{{c1::speedKmh / MAX_PLAUSIBLE_SPEED_KMH}}` (clamped to 1.0) whenever a previous geo point exists — independent of the `isImpossible` boolean flag — because ADR 0005 treats it as a continuous signal, not a boolean one wearing continuous math.

Extra: xylem-l6 · Challenge: Deciding Whether Continuous Severity Gates on the Boolean Flag
See: docs/journal/xylem-l6-2026-07-17T1630-fusion-function-implementation.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, sentinel-l7, cross-repo, decision]
---
Q: What did checking Xylem-L6/Sentinel-L7 wiring readiness turn up about Sentinel-L7 ADR-0032, and why does it matter?

A: ADR-0032 (Sentinel-L7's policy-corpus prerequisite named in Xylem-L6's ADR-0004) already exists and is Accepted — the three saas-tagged policy files are done — but it's self-reportedly blocked on WatchAxioms/the Synapse-L4 emitter stamping domain: 'saas' on real Axiom payloads. Combined with ADR 0002's stated integration shape (a typed Axiom contract over Sentinel-L7's MCP endpoint), this means Xylem-L6's own wiring work is likely what has to close that gap — the two prerequisites aren't independent, which is why the fusion function (the one piece that unblocks on its own) was picked as the next step instead.

Extra: xylem-l6 · Decision: A Fork Discovered Mid-Task — Sentinel-L7's Policy-Corpus ADR Already Exists
See: docs/journal/xylem-l6-2026-07-17T1630-fusion-function-implementation.md
