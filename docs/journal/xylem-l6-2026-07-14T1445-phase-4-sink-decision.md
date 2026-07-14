---
id: xylem-l6-2026-07-14T1445-phase-4-sink-decision
repo: xylem-l6
title: "Xylem-L6 Phase 4 Sink Decision (ADR 0004 — Sentinel-L7)"
date: 2026-07-14
phase: 4
tags: [adr, decision-record, phase-gate, status-escalation, sentinel-l7, sink-decision]
files:
  - docs/adr/0004-sentinel-l7-sink-decision.md
  - README.md
---

### Pattern: ADR Status Escalation (Proposed → Accepted, via a New Record)
ADR 0002 carried an explicit status of "Proposed — documents direction, not a
build decision," recording the Sentinel-L7 direction honestly without
authorizing it. ADR 0004 doesn't edit ADR 0002 in place to flip that status;
it's a separate, new **decision record** that escalates the same direction to
Accepted. This mirrors the shape of the Phase 2 addendum to ADR 0001 (preserve
the original text as a true record of what was decided at the time, layer the
resolution on top rather than rewriting history) but goes one step further —
a whole new ADR, not an addendum to the old one, because ADR 0002's job was
always to be superseded by a future decision, not amended by one.

### Anti-Pattern Avoided: Deferral Drift (Mistaking "Wait Until It Hurts" for "Decide Deliberately")
ADR 0001's Phase 4 gate was specific: the sink decision gets made "deliberately
and by ADR when it's reached, not assumed now." That's a different posture
than "wait until it hurts" — it's not license to keep deferring indefinitely
just because neither of ADR 0002's two prerequisites (fusion function,
policy corpus) exists yet. Those prerequisites block *implementation*, not
the *decision* of where implementation should eventually point. Treating
"prerequisites unbuilt" as a reason to keep deferring the decision itself
would have been drift wearing the costume of discipline — the trap this ADR
explicitly named and avoided in its Rationale section.

### Challenge: None This Phase
No implementation challenge occurred — this phase produced a decision record,
not code, so there was no bug to trace or root cause to isolate. The nearest
analog is the judgment call captured in the Decision section below:
recognizing that ADR 0001's "decide when reached" condition had actually been
satisfied, which was a timing/interpretation question, not a technical one.

### Decision: Xylem-L6's Phase 4 Sink Is Sentinel-L7
Of the three candidates ADR 0001 named — standalone dashboard, EventHorizon,
Sentinel-L7 — Sentinel-L7 was chosen because it's the only one that tests a
generality the suite already claims rather than building new surface area to
have a consumer at all. A dashboard would demonstrate charting, not
fusion/policy-classification work; EventHorizon has no scoring or policy-RAG
concept, so routing scored signals there would misuse its existing role
rather than extend it. Sentinel-L7's own README already names "SaaS API
activity" as one of four target domains, unexercised until now — choosing it
is the first real test of that claim. The decision fixes *direction* only:
two follow-up ADRs (a fusion-function ADR in this repo, a policy-corpus ADR
in Sentinel-L7) are still required before any integration code is written,
and this ADR authorizes neither.

### Decision: Recognize the Phase 4 Gate Was Already Met, Rather Than Defer Further
The alternative seriously considered was deferring again — plausible, since
neither of ADR 0002's two prerequisites exists yet. Rejected because ADR
0001's actual condition for reaching Phase 4 was "decide deliberately when
reached," and Phase 4 had been reached (Phases 1–3 complete). Continuing to
defer without a *new* reason beyond the prerequisites already named and
already known in ADR 0002 would have contradicted that posture rather than
honored it. This was confirmed, not corrected, in review — the "decide when
reached" framing from ADR 0001 was judged to have worked exactly as
intended.
