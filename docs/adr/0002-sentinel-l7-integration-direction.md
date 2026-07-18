# ADR 0002 — Sentinel-L7 Integration Direction (Forward-Looking, Not Committed)

**Status:** Proposed — documents direction, not a build decision (amended 2026-07-17 — the Decision section's claim that Synapse-L4 integrates with Sentinel-L7 "over Sentinel-L7's existing MCP endpoint" is factually wrong: Synapse-L4's actual client delivers Axioms via direct Redis `XADD`, no MCP involved. The underlying principle — reuse the existing pattern rather than inventing a second integration shape — still holds and is acted on in ADR 0007, just via the corrected mechanism.)
**Date:** 2026-07-13

---

## Context

Sentinel-L7's own README states it processes "any scored event stream — financial events, medical access logs, SaaS API activity, raw system telemetry — and classifies each event against an indexed corpus of domain-specific policy documents." SaaS API activity is named there explicitly, as one of four target domains, alongside financial events and raw system telemetry — the two domains it's actually been built and exercised against so far.

This changes the framing ADR 0001 used when it treated a Sentinel-L7 hookup as scope-widening to be avoided. It isn't widening — it's the first opportunity to test a generality Sentinel-L7 already claims for itself in its own README but hasn't yet exercised on this specific domain. Financial events and raw system telemetry are the two domains it's actually been built and exercised against so far (telemetry via the EventHorizon/Synapse-L4 path); medical access logs and SaaS API activity remain unexercised. Xylem-L6, built for unrelated reasons (closing a streaming-fundamentals gap, ADR 0001), happens to produce exactly the kind of input the SaaS API activity claim needs a real test against.

This ADR exists to name that direction honestly — including everything that would need to be true before it's buildable — without committing Xylem-L6 or Sentinel-L7 to any of it prematurely. Nothing here authorizes implementation.

## Decision

No integration is built now. This ADR records what would be required, so the direction is documented rather than lost, and so neither repo's future work silently assumes it.

Two things are missing before this is real, not one:

1. **A scored-output contract on Xylem-L6's side.** Sentinel-L7 consumes *scored* events — a computed risk score, not raw detections. Xylem-L6's Phase 1–2 design (per ADR 0001) produces discrete signals: velocity breach, first-seen IP, impossible travel, scope escalation. Turning that into a single score requires a fusion function — max-of-signals, weighted sum, or something more principled — that doesn't exist yet and shouldn't be designed before there are real signals from Phase 2 to fuse.
2. **A SaaS-domain policy corpus on Sentinel-L7's side.** Its RAG pipeline classifies scored events against indexed policy documents; for financial events that's presumably AML/compliance text. No equivalent corpus exists yet for SaaS API activity. Candidates worth evaluating when this is picked up: OWASP API Security Top 10, NIST 800-63 (digital identity/auth), SOC 2 access-control language. This is Sentinel-L7-side work, unrelated to anything in Xylem-L6.

If both are eventually built, the interface between them should follow the pattern Synapse-L4 already established with `Axiom`: a typed, immutable contract over Sentinel-L7's existing MCP endpoint — not a bespoke second integration shape invented for a second domain.

## Rationale

Recording this now, before either prerequisite exists, matters for a specific reason: without it, a future reader of either repo could reasonably assume the SaaS API activity domain in Sentinel-L7's README was aspirational copy rather than a real target, or that Xylem-L6's standalone posture (ADR 0001) meant integration was never considered. Neither is true. The direction was considered deliberately and deferred deliberately — the gap is two concrete, named prerequisites, not a vague someday.

Keeping this as its own ADR rather than folding it into ADR 0001 keeps the two decisions cleanly separable: ADR 0001 is fully justified by the streaming-fundamentals gap alone, independent of whether Sentinel-L7 integration ever happens. This ADR shouldn't be load-bearing for that justification, and shouldn't need to be revisited if Xylem-L6's build proceeds and this direction simply doesn't get picked up for a while.

## Alternatives Considered

| Option | Pro | Con |
|---|---|---|
| Say nothing until both prerequisites are built, document the integration then | Avoids documenting an undecided direction | Loses the "why SaaS API activity, not medical access logs or telemetry" reasoning, which was decided in conversation and would otherwise not exist anywhere in either repo |
| Commit to building the scored-output contract as part of Xylem-L6 Phase 2 | Momentum; integration ready sooner | Phase 2 in ADR 0001 is about proving stateful signals work at all; bolting a scoring contract onto it conflates "does the signal detection work" with "is it in the right shape for a consumer that doesn't exist yet" |
| Build the Sentinel-L7 policy corpus speculatively now, before Xylem-L6 has any real signals to classify | Removes one prerequisite early | Corpus design without real scored-event examples to validate against is exactly the kind of speculative scope ADR 0001 already named as a departure from "wait until it hurts" — doing it twice compounds the risk of the corpus being wrong for output that doesn't exist yet |

## Consequences

- Neither Xylem-L6 nor Sentinel-L7 is authorized by this ADR to begin implementing scoring or corpus work. A follow-up ADR is required in each repo when either is actually picked up.
- Xylem-L6's Phase 2 (ADR 0001) should track which signals it produces in a form that would be reusable as scoring inputs later, without designing the fusion function now — an implementation note for Claude Code, not an architectural commitment.
- Sentinel-L7's README claim of handling "any scored event stream" remains partially untested until this is built. That's an accurate thing to say about the current state of the suite, not a gap to be hidden in future resume or blog copy.