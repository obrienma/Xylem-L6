---
id: xylem-l6-2026-07-14T1620-fusion-function-max-of-signals
repo: xylem-l6
title: "Xylem-L6 Fusion Function Decision (ADR 0005 — Max-of-Signals)"
date: 2026-07-14
phase: 4
tags: [adr, decision-record, fusion-function, max-of-signals, data-availability, normalization, sentinel-l7]
files:
  - docs/adr/0005-fusion-function-max-of-signals.md
  - README.md
---

### Pattern: Deciding Against the Data You Actually Have, Not the Data You Wish You Had
Before choosing a fusion strategy, the codebase was checked directly rather
than reasoned about in the abstract: `checkpoint.ts` was confirmed to persist
only each tracker's *current* state (overwritten every event, not appended
to), and the only per-event output anywhere is an interpolated `console.log`
line in `index.ts` — never written to disk, never labeled. That grounding
step is what turned "weighted-sum feels more sophisticated" into a concrete,
checkable claim: a weighted-sum fusion function needs signal co-occurrence
history and outcome labels to fit weights against, and neither exists
anywhere in this system today.

### Anti-Pattern Avoided: Invented Precision
A weighted-sum fusion function looks more rigorous than max-of-signals — it
has coefficients, it implies calibration — but without real co-occurrence
and outcome data, those coefficients would just be guesses wearing the
notation of measurement. Choosing max-of-signals instead of a plausible-
looking but unfounded weighted sum avoids presenting invented numbers as if
they were derived from evidence.

### Challenge: None This Phase
Like ADR 0004, this phase produced a decision record, not code — no bug to
trace. The real difficulty was a judgment call, not a technical one, and is
captured in the Decision section below.

### Decision: Fusion Is Max-of-Signals, Not Weighted-Sum
The hardest part of this ADR was sitting with max-of-signals' known,
acknowledged weakness: it collapses to the same score whether one signal
fires strongly or all four fire weakly simultaneously, and the latter —
several marginal signals co-occurring — is arguably the more classic
account-takeover shape than any single strong signal alone. That weakness
was accepted deliberately rather than papered over, because the alternative
that would address it (weighted-sum) can't be justified with anything
currently in this system. The explicit revisit trigger is Sentinel-L7 being
wired in and producing verdicts: that integration creates the first labeled
dataset (event → fused score → verdict) this system has ever had, at which
point weighted-sum becomes reconsiderable on its merits.

### Decision: Reuse Existing Demo Thresholds for Normalization, Don't Invent New Ones
Continuous signals (velocity count, impossible-travel speed) are normalized
to `[0, 1]` severity by dividing by the same thresholds already used for the
demo's console bracket flags (`VELOCITY_BREACH_THRESHOLD = 3`,
`MAX_PLAUSIBLE_SPEED_KMH = 900`) rather than picking a second, parallel set
of numbers for fusion specifically. Two threshold sets for the same signal —
one for the `[VELOCITY BREACH]` console tag, another for fusion severity —
would drift independently for no reason. This was confirmed as the right
call on review, along with the ADR's overall scope: fixing the fusion
function itself while explicitly leaving transmission/wiring to Sentinel-L7
as separate, not-yet-authorized work.
