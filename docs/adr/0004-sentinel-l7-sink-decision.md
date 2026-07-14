# ADR 0004 — Xylem-L6 Phase 4 Sink Decision: Sentinel-L7

**Status:** Accepted
**Date:** 2026-07-14

---

## Context

ADR 0001 deliberately deferred the Phase 4 sink decision, naming three candidates without choosing among them: a standalone dashboard, EventHorizon, and Sentinel-L7. ADR 0002 recorded the Sentinel-L7 direction in detail — including two concrete prerequisites — but its status was explicitly "Proposed — documents direction, not a build decision," and it authorized nothing.

Nothing about those prerequisites has changed since ADR 0002 was written. Phases 1–3 are complete (canonical event contract, both adapters, four stateful signals, checkpointing), and Phase 4 is reached. This ADR is the deliberate decision ADR 0001 required before Phase 4 could proceed — it converts ADR 0002's direction from proposed to committed, without building either prerequisite itself.

## Decision

**Xylem-L6's Phase 4 sink is Sentinel-L7.**

This decision does not implement the integration. Per ADR 0002, two things remain missing, and each gets its own follow-up ADR in its own repo when picked up:

1. **A fusion-function ADR (Xylem-L6 side)** — how the four discrete signals (velocity breach, first-seen IP, impossible travel, scope escalation) collapse into the single score Sentinel-L7 consumes. Not designed here; ADR 0002 already noted this shouldn't be designed before real Phase 2 signals exist to fuse, and that condition is now satisfied but the design work itself is still separate.
2. **A policy-corpus ADR (Sentinel-L7 side)** — which SaaS-domain policy documents get indexed, and how the retrieval filter should treat more than one of them per event (single shared domain tag vs. an OR-filter across domains). Entirely Sentinel-L7-side, unrelated to Xylem-L6's code.

This ADR fixes the destination so those two can design toward a settled target, rather than continuing to hedge a decision that was already the leading candidate.

## Rationale

The other two candidates don't clear the same bar. A standalone dashboard is net-new visualization work with no reuse anywhere else in the suite — it would demonstrate charting, not the fusion/policy-classification work the rest of the portfolio is built around. EventHorizon is a four-stage message pipeline (Ingestion → Processing → Storage → Observation); it moves and persists events, but it has no scoring or policy-RAG concept anywhere in it — routing scored security signals there would be misusing its role, not extending it.

Sentinel-L7, by contrast, already claims "SaaS API activity" as one of four target domains in its own README, alongside financial events and raw system telemetry — the two it's actually been exercised against. Choosing it here isn't inventing a consumer to have one; it's the first real test of a generality Sentinel-L7 already asserts about itself but hasn't proven. That's a stronger thing to point to than a purpose-built dashboard would be.

Deciding now, rather than deferring further, follows the same "wait until it hurts" logic in reverse: the ADR 0001 gate for reaching Phase 4 was that the decision be made deliberately when reached, not assumed in advance — and it's been reached. Continuing to defer without a new reason would be drift, not discipline.

## Alternatives Considered

| Option | Pro | Con |
|---|---|---|
| Standalone dashboard | No dependency on Sentinel-L7's readiness; full control over presentation | Net-new visualization work with no reuse elsewhere in the suite; doesn't exercise fusion or policy classification |
| EventHorizon | Already-existing pipeline, no new integration surface | Wrong role — a persistence/observation pipeline has no scoring or policy-RAG concept; would misuse it rather than extend it |
| Defer the sink decision further | Avoids committing before either prerequisite exists | ADR 0001's own condition for reaching Phase 4 has been met; deferring without a new reason contradicts the "decided deliberately when reached" posture that ADR itself set |

## Consequences

- Two follow-up ADRs — fusion-function (Xylem-L6) and policy-corpus (Sentinel-L7) — are required before any integration code is written. This ADR authorizes neither directly.
- Xylem-L6 remains standalone and does not call Sentinel-L7 until the fusion-function ADR exists and is implemented — this ADR fixes direction, not wiring.
- Sentinel-L7's "any scored event stream" README claim gets its second untested domain (SaaS API activity) exercised once both follow-ups land — that's a milestone worth noting in either repo's docs when it happens, not before.
- The multi-corpus filter shape (single shared domain tag vs. OR-filter across `owasp`/`nist`/`soc2`) is an open question for the policy-corpus ADR, not resolved here.
