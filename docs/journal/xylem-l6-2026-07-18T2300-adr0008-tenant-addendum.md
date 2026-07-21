---
id: xylem-l6-2026-07-18T2300-adr0008-tenant-addendum
repo: xylem-l6
title: "ADR 0008 Addendum — tenant on the Synapse-L4 Payload (decision recorded, not yet implemented)"
date: 2026-07-18
phase: 7
tags: [adr, decision-record, synapse-l4, tenant, optional-field, cross-repo, scope-discipline, decision-then-implementation]
files:
  - docs/adr/0008-synapse-l4-payload-mapping.md
  - README.md
---

### Pattern: Mirroring the Receiving Side's Own Optional-Field Convention
`buildIngestPayload()`'s new conditional `tenant` field doesn't invent a fresh convention for "how to send an optional value" — it copies the shape Synapse-L4's own `SentinelClient.post_axiom` already uses for its `domain` field (`if axiom.domain is not None`). Picking the receiving side's existing idiom, rather than whatever felt natural in TypeScript, keeps the two ends of the boundary consistent about what "the field is absent" means on the wire.

### Anti-Pattern Avoided: Unconditional Optional Spread
The alternative was `tenant: event.tenant` unconditionally. `ApiActivityEvent.tenant` is `string | undefined`, and JSON.stringify drops keys whose value is `undefined` — so in practice it wouldn't have crashed, but it would have been one accidental type change away from silently sending `tenant: null` instead of omitting the key, with no test catching the difference since both look like "no tenant" until a receiver actually inspects presence-vs-null. Conditional spread (`...(event.tenant !== undefined && { tenant: event.tenant })`) makes key-absence structural rather than a JSON-serialization accident.

### Decision: Record the Addendum Before Touching `src/sinks/synapse-l4/index.ts`
`buildIngestPayload()` does not have a `tenant` field yet — this session only changed the ADR and `README.md`. That's the same decision-then-implementation split ADR 0004/0005 already used project-wide, applied again here: writing the addendum forced an honest check of whether `tenant` actually reaches Sentinel-L7 if implemented today, which surfaced that it wouldn't (Synapse-L4's `RawTelemetry`/`AxiomDraft`/`Axiom` models don't accept the key yet, and Pydantic ignores unknown dict keys silently rather than rejecting them). Writing the code first would have made that gap easy to miss, since the local test suite has no way to assert what a different repo's model does with an extra key.

### Challenge: None
No real challenge in this session — the addendum's content was fully specified going in, and the corresponding change was a straightforward doc addition plus two README pointer updates (the ADR/docs table row and a new Deliberately Deferred bullet). Stated explicitly per the skill's rule against omitting this section rather than implying otherwise.
