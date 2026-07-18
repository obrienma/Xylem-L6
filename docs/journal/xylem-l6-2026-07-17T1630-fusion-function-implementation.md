---
id: xylem-l6-2026-07-17T1630-fusion-function-implementation
repo: xylem-l6
title: "Xylem-L6 Fusion Function Implementation (ADR 0005 — from decision to code)"
date: 2026-07-17
phase: 6
tags: [adr, fusion-function, max-of-signals, pure-function, thresholds, single-source-of-truth, sentinel-l7, cross-repo, scope-discipline]
files:
  - src/core/fusion.ts
  - src/core/thresholds.ts
  - src/index.ts
  - tests/core/fusion.test.ts
  - README.md
---

### Pattern: Making "Single Source of Truth" Mechanical, Not Just Documented
ADR 0005's Rationale already stated the intent — reuse `index.ts`'s existing
demo thresholds for fusion normalization instead of picking a second set —
but until now that was true only by hand-copying two numbers into a second
file. Implementing the fusion function was the forcing moment to actually
extract `VELOCITY_BREACH_THRESHOLD` and `MAX_PLAUSIBLE_SPEED_KMH` into
`src/core/thresholds.ts`, so `index.ts`'s console bracket flags and
`fusion.ts`'s severity normalization both import the same constants. Drift
between the two is now a compile-time impossibility, not a code-review
discipline.

### Anti-Pattern Avoided: Wiring a New Capability In Just Because It's Now Possible
Once `fuseSignals()` existed and worked, the obvious next move was to call it
from `index.ts` and print the fused score on the demo's console line — the
same move made for ADR 0006's `tenant` field one phase earlier. It was
deliberately not made here. ADR 0005's own Consequences section already
states, as an accepted outcome, that the score payload would have "a defined
shape now even though nothing consumes it yet." That's not an oversight to
fix opportunistically; it's the recorded decision. Wiring it into the console
line would have quietly done more than ADR 0005 authorized, on the strength
of "well, it's right there now" rather than any actual new authorization.

### Challenge: Deciding Whether Continuous Severity Gates on the Boolean Flag
ADR 0005's Decision text — "severity = min(value / threshold, 1.0)" for
continuous signals — reads unambiguously in isolation, but implementing it
raised a real question: should `impossibleTravel` severity be zero whenever
`isImpossible` is false (i.e., only compute severity for events already
flagged), or should it scale continuously off the raw `speedKmh` regardless
of the flag, the same way `velocity` severity scales off the raw count even
below `VELOCITY_BREACH_THRESHOLD`? The ADR's own framing of "continuous vs.
boolean signals" only makes sense if continuous signals are graded
continuously — gating on the flag would make `impossibleTravel` a de facto
boolean signal wearing continuous math. Resolved by re-reading ADR 0005's own
signal taxonomy rather than guessing: `impossibleTravel` severity is
`speedKmh / MAX_PLAUSIBLE_SPEED_KMH` (clamped) whenever a previous point
exists, independent of the flag; `null` (no previous point) is the only
zero case.

### Decision: A Fork Discovered Mid-Task — Sentinel-L7's Policy-Corpus ADR Already Exists
Checking Xylem-L6/Sentinel-L7 wiring readiness (the question that led to this
implementation step) surfaced that Sentinel-L7 ADR-0032 — the policy-corpus
prerequisite ADR 0004 named as still-required — was already written and
Accepted, one day before this check, on the Sentinel-L7 side. It documents
the corpus itself as done (three `saas`-tagged policy files) but self-reports
still being blocked on `WatchAxioms`/the Synapse-L4 emitter stamping
`domain: 'saas'` on real Axiom payloads. Combined with ADR 0002's own stated
integration shape — a typed Axiom contract over Sentinel-L7's MCP endpoint,
the same pattern Synapse-L4 uses — this reframes what "wiring Xylem-L6 to
Sentinel-L7" actually requires: not two independent prerequisites converging
on their own, but Xylem-L6's own integration work likely being the thing
that has to close Sentinel-L7's remaining producer-side gap. This wasn't
resolved today — recorded here because it changes the shape of the next real
step, and was the reason the fusion function (the Xylem-L6-side prerequisite
that unblocks independently of anything Sentinel-L7-side) was picked as
today's task over Axiom-emission work, which is not independently unblocked.
