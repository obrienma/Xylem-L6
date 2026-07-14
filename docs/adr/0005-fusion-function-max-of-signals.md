# ADR 0005 — Fusion Function: Max-of-Signals

**Status:** Accepted
**Date:** 2026-07-14

---

## Context

ADR 0004 committed Sentinel-L7 as Xylem-L6's Phase 4 sink but authorized neither of the two prerequisites it named. This ADR is the first of those: a fusion function that turns the four discrete signals Xylem-L6 already computes — velocity breach, first-seen IP, impossible travel, scope escalation — into the single score Sentinel-L7's scored-event consumers expect.

The candidate approaches were discussed directly against what data actually exists in this codebase today, not in the abstract. Two things were checked and confirmed absent:

- **No per-event signal history is persisted anywhere.** The checkpoint store (`checkpoint.ts`) holds only each tracker's *current* state — the rolling velocity window, the first-seen IP sets, the last-known geo point, the seen-scopes set — overwritten every event, not appended to. It answers "what does the tracker need to resume correctly," not "what happened on past events."
- **No labels exist.** The only per-event output today is a `console.log` line in `index.ts` — an interpolated string to stdout, never written to disk, never structured. Nothing downstream has ever judged whether a flagged event was a true or false positive, because nothing downstream has existed until this integration.

A weighted-sum fusion function requires weights fit against exactly this kind of data — signal co-occurrence patterns and outcome labels — neither of which exists. That isn't a stylistic objection to weighted-sum; it's a hard blocker on it being anything other than invented numbers today.

## Decision

**Fusion is max-of-signals**, computed as:

1. Each of the four signals is normalized independently to a severity in `[0, 1]`:
   - **Boolean signals** (first-seen IP, scope escalation): `1.0` when fired, `0` otherwise.
   - **Continuous signals** (velocity count, impossible-travel speed): `severity = min(value / threshold, 1.0)`, reusing the thresholds already defined in `index.ts` for the demo's bracket flags (`VELOCITY_BREACH_THRESHOLD = 3`, `MAX_PLAUSIBLE_SPEED_KMH = 900`) rather than introducing a second, parallel set of magic numbers.
2. The event's overall score is the **maximum** of the four normalized severities.
3. The emitted payload carries both the score and which signal(s) produced it — not a bare number — so a downstream consumer (Sentinel-L7, once wired) can explain *why* an event scored the way it did, not just that it did.

This ADR fixes the fusion function itself. It does not fix how or when the resulting score is transmitted to Sentinel-L7 — that's wiring, and per ADR 0004's Consequences, Xylem-L6 remains standalone until that's its own decision.

## Rationale

Reusing the existing demo-flag thresholds for normalization, rather than picking new ones, keeps a single source of truth for "what counts as severe" per signal — two different threshold sets for the same signal (one for the console `[VELOCITY BREACH]` tag, another for fusion severity) would drift independently for no reason.

Max-of-signals over weighted-sum is a claim about data availability, not a claim that max-of-signals is the theoretically correct fusion strategy. It measurably discards information — a single strongly-fired signal and four simultaneously weak ones score identically, and the latter is arguably the more classic account-takeover pattern. That weakness is accepted deliberately here because the alternative that would address it (weighted-sum) can't be justified with anything currently in this system.

## Alternatives Considered

| Option | Pro | Con |
|---|---|---|
| Weighted sum | Captures signal co-occurrence, which max-of-signals discards | Weights would be invented — no signal-history or outcome-label data exists anywhere in the system to fit them against |
| Simple count-of-signals-fired (e.g. 2 of 4) | Trivial to implement | Discards magnitude entirely — a velocity count of 3 and a velocity count of 30 count the same, which is a worse loss of information than max-of-signals' co-occurrence blindness |
| ML-based classifier | Could in principle learn the right fusion weights from real outcomes | No training data exists (same root cause as weighted-sum's rejection); drastically overbuilt for current signal volume and demo scope |

## Consequences

- **Considered and rejected: weighted-sum.** Revisit trigger: once Sentinel-L7 is actually wired in and producing verdicts on Xylem-L6-sourced events, that wiring creates the first labeled dataset this system has ever had (event → fused score → verdict). At that point weighted-sum becomes reconsiderable on its merits, not before.
- The fusion function is a pure function over already-computed tracker outputs — no new external dependency, no change to the four trackers themselves.
- A fifth signal added later (e.g. an Okta-adapter failed-auth-burst signal) needs its own normalization mapping before joining the max; this ADR's pattern extends to that case without needing to be revisited itself.
- The emitted score payload has a defined shape now even though nothing consumes it yet — the transmission mechanism to Sentinel-L7 is separate, not-yet-authorized work.
