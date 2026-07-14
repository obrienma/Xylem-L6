---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, adr, data-availability]
---
Weighted-sum fusion was rejected not on stylistic grounds but because it requires `{{c1::signal co-occurrence history and outcome labels}}` to fit weights against, and neither exists anywhere in Xylem-L6 — `checkpoint.ts` overwrites tracker state per event rather than appending to it, and the only per-event output is an unlabeled `console.log` line.

Extra: xylem-l6 · Pattern: Deciding Against the Data You Actually Have, Not the Data You Wish You Had
See: docs/journal/xylem-l6-2026-07-14T1620-fusion-function-max-of-signals.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, anti-pattern]
---
Choosing max-of-signals over a plausible-looking weighted sum without real co-occurrence/outcome data avoids `{{c1::invented precision}}` — coefficients that look rigorous but are really just guesses wearing the notation of measurement.

Extra: xylem-l6 · Anti-Pattern Avoided: Invented Precision
See: docs/journal/xylem-l6-2026-07-14T1620-fusion-function-max-of-signals.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, adr, max-of-signals]
---
Q: What known weakness does ADR 0005 accept by choosing max-of-signals over weighted-sum, and why is that weakness accepted rather than fixed?

A: Max-of-signals scores a single strongly-fired signal the same as four simultaneously weak signals, even though the latter — several marginal signals co-occurring — is arguably the more classic account-takeover pattern. This is accepted deliberately because the fix (weighted-sum) would require signal co-occurrence history and outcome labels that don't exist anywhere in the system yet; inventing weights without that data would just be presenting guesses as if they were derived from evidence.

Extra: xylem-l6 · Decision: Fusion Is Max-of-Signals, Not Weighted-Sum
See: docs/journal/xylem-l6-2026-07-14T1620-fusion-function-max-of-signals.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, revisit-trigger]
---
The explicit revisit trigger for reconsidering weighted-sum is Sentinel-L7 being wired in and producing verdicts on Xylem-L6-sourced events — that integration creates the system's first `{{c1::labeled dataset}}` (event → fused score → verdict), which doesn't exist before then.

Extra: xylem-l6 · Decision: Fusion Is Max-of-Signals, Not Weighted-Sum
See: docs/journal/xylem-l6-2026-07-14T1620-fusion-function-max-of-signals.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, normalization]
---
Continuous-signal severity for fusion reuses the demo's existing console-flag thresholds (`VELOCITY_BREACH_THRESHOLD = 3`, `MAX_PLAUSIBLE_SPEED_KMH = 900`) rather than a second parallel set, because `{{c1::two threshold sets for the same signal would drift independently for no reason}}`.

Extra: xylem-l6 · Decision: Reuse Existing Demo Thresholds for Normalization, Don't Invent New Ones
See: docs/journal/xylem-l6-2026-07-14T1620-fusion-function-max-of-signals.md
