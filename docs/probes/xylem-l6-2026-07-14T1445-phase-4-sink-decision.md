---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, adr, status-escalation]
---
ADR 0004 doesn't edit ADR 0002's "Proposed" status in place — it escalates the direction to Accepted via a `{{c1::separate, new ADR}}`, the same preserve-the-original-record instinct as the Phase 2 addendum to ADR 0001.

Extra: xylem-l6 · Pattern: ADR Status Escalation (Proposed → Accepted, via a New Record)
See: docs/journal/xylem-l6-2026-07-14T1445-phase-4-sink-decision.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, phase-gate, drift]
---
ADR 0001's Phase 4 gate was "decide deliberately when reached," not "wait until it hurts" — treating the two missing prerequisites from ADR 0002 as a reason to keep deferring the sink *decision itself* would have been `{{c1::deferral drift}}` wearing the costume of discipline, since those prerequisites block implementation, not the choice of destination.

Extra: xylem-l6 · Anti-Pattern Avoided: Deferral Drift (Mistaking "Wait Until It Hurts" for "Decide Deliberately")
See: docs/journal/xylem-l6-2026-07-14T1445-phase-4-sink-decision.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, adr, sink-decision]
---
Q: Why was Sentinel-L7 chosen as Xylem-L6's Phase 4 sink over a standalone dashboard or EventHorizon?

A: A standalone dashboard would be net-new visualization work with no reuse elsewhere in the suite, demonstrating charting rather than fusion/policy-classification. EventHorizon has no scoring or policy-RAG concept in its four-stage pipeline, so routing scored signals there would misuse its existing role rather than extend it. Sentinel-L7's own README already claims "SaaS API activity" as one of four target domains it hasn't yet exercised — choosing it tests a generality the suite already asserts about itself, rather than inventing a consumer just to have one.

Extra: xylem-l6 · Decision: Xylem-L6's Phase 4 Sink Is Sentinel-L7
See: docs/journal/xylem-l6-2026-07-14T1445-phase-4-sink-decision.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, follow-up-adr]
---
ADR 0004 fixes Sentinel-L7 as the Phase 4 sink but authorizes no integration code — a `{{c1::fusion-function ADR}}` on Xylem-L6's side and a `{{c2::policy-corpus ADR}}` on Sentinel-L7's side are still required first.

Extra: xylem-l6 · Decision: Xylem-L6's Phase 4 Sink Is Sentinel-L7
See: docs/journal/xylem-l6-2026-07-14T1445-phase-4-sink-decision.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, phase-gate]
---
The alternative seriously considered for Phase 4 was deferring the sink decision again, since neither ADR 0002 prerequisite exists yet — rejected because Phase 4 had already been `{{c1::reached}}` (Phases 1–3 complete) and deferring further without a *new* reason would have contradicted ADR 0001's "decide deliberately when reached" posture.

Extra: xylem-l6 · Decision: Recognize the Phase 4 Gate Was Already Met, Rather Than Defer Further
See: docs/journal/xylem-l6-2026-07-14T1445-phase-4-sink-decision.md
