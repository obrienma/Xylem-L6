---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, adr, optional-field, cross-repo]
---
`buildIngestPayload()`'s conditional `tenant` field doesn't invent a new convention — it mirrors Synapse-L4's own `SentinelClient.post_axiom`, which already handles its `domain` field with {{c1::`if axiom.domain is not None`}}.

Extra: xylem-l6 · Pattern: Mirroring the Receiving Side's Own Optional-Field Convention
See: docs/journal/xylem-l6-2026-07-18T2300-adr0008-tenant-addendum.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, anti-pattern, json-serialization]
---
Spreading `tenant: event.tenant` unconditionally wouldn't crash today, since `JSON.stringify` drops `undefined`-valued keys — but it makes key-absence an accident of serialization rather than structural. `{{c1::...(event.tenant !== undefined && { tenant: event.tenant })}}` makes the key's presence conditional on the value actually existing.

Extra: xylem-l6 · Anti-Pattern Avoided: Unconditional Optional Spread
See: docs/journal/xylem-l6-2026-07-18T2300-adr0008-tenant-addendum.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, decision, decision-then-implementation, scope-discipline]
---
Q: Why did this session record the ADR 0008 tenant addendum without also changing `src/sinks/synapse-l4/index.ts` to actually add the field?

A: Same decision-then-implementation split ADR 0004/0005 already used project-wide. Writing the addendum first forced an honest check of whether `tenant` would actually reach Sentinel-L7 if implemented today — it wouldn't, because Synapse-L4's `RawTelemetry`/`AxiomDraft`/`Axiom` models don't accept the key yet, and Pydantic silently ignores unknown dict keys rather than rejecting them. That gap is easy to miss once code exists and local tests pass, since nothing in this repo's test suite can assert what a different repo's model does with an extra key.

Extra: xylem-l6 · Decision: Record the Addendum Before Touching src/sinks/synapse-l4/index.ts
See: docs/journal/xylem-l6-2026-07-18T2300-adr0008-tenant-addendum.md
