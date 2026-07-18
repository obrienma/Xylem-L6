---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, adr, cross-repo, verification]
---
Even though ADR 0007 had already corrected ADR 0002's wrong MCP-endpoint claim, its own Decision text still got one thing wrong: it said `source_id` was a Synapse-L4 responsibility. Reading `synapse-l4`'s actual `RawTelemetry` model directly showed `source_id` is `{{c1::a caller-supplied field on the POST /ingest request body}}`, not something Synapse-L4 invents.

Extra: xylem-l6 · Pattern: Re-Verifying a Just-Discovered ADR's Own Claims Before Building Against It
See: docs/journal/xylem-l6-2026-07-17T2200-synapse-l4-integration.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, anti-pattern, adr-discipline]
---
Q: Why wasn't ADR 0007 treated as a finished, fully-trustworthy contract once it was Accepted and had already fixed one factual error?

A: "Accepted" describes the state of a decision, not the correctness of every factual claim inside it — especially claims about a second repo's internals, which can drift or simply be wrong without anything forcing the ADR to notice. Skipping a direct code read because the ADR already looked diligent would have produced a client built on an incorrect assumption about who owns source_id, likely discovered only at runtime (or silently, since Pydantic wouldn't loudly reject an unexpected payload shape).

Extra: xylem-l6 · Anti-Pattern Avoided: Treating "Accepted" as "Nothing Left to Verify"
See: docs/journal/xylem-l6-2026-07-17T2200-synapse-l4-integration.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, challenge, credentials-boundary]
---
Q: What's the actual distinction between "verify the code" and "inspect the secrets" that this phase's rejected tool call surfaced?

A: Reading a repo's application logic (axiom.py, ingest.py) is safe, freely-doable evidence-gathering for a design decision. Reaching for `.env` — even just to check whether the file exists, not to read its contents — crosses into a credentials boundary, because "checking existence" isn't obviously distinguishable from "checking what's configured" to someone watching the tool calls happen. The right move is to verify code freely but ask before touching anything that could hold secrets, even for a presence check.

Extra: xylem-l6 · Challenge: The Line Between Verifying Code and Inspecting Credentials
See: docs/journal/xylem-l6-2026-07-17T2200-synapse-l4-integration.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, decision, fusion-function]
---
`metric_value` was set to `firedCount` rather than restating `score`, because ADR 0005's own Rationale had already named, as a deliberately accepted weakness, that max-of-signals scores identically whether {{c1::one signal fires strongly or several fire weakly at once}} — `firedCount` recovers exactly that discarded information without changing the score itself.

Extra: xylem-l6 · Decision: metric_value Is firedCount, Not score Restated
See: docs/journal/xylem-l6-2026-07-17T2200-synapse-l4-integration.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, decision, scope-discipline]
---
Q: Why is the Synapse-L4 sink gated behind XYLEM_SYNAPSE_L4_ENABLED instead of being called unconditionally now that fuseSignals() has a real caller?

A: Neither ADR 0007 nor ADR 0008 decided whether calling Synapse-L4 should be the default behavior of npm run dev. Wiring it in unconditionally would have broken the project's standing zero-dependency demo property — anyone running the demo without a Synapse-L4 instance up would see a wall of send-failure log lines. Gating it behind an env var mirrors exactly how XYLEM_ADAPTER=github-events-live already works, keeping the default path dependency-free while making the feature fully real behind one flag.

Extra: xylem-l6 · Decision: The Sink Is Opt-In (XYLEM_SYNAPSE_L4_ENABLED), Not Default-On
See: docs/journal/xylem-l6-2026-07-17T2200-synapse-l4-integration.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, decision, testing, end-to-end]
---
Q: Why wasn't a green mocked test suite (tests/sinks/synapse-l4.test.ts) treated as sufficient proof the integration works?

A: Mocked tests only prove Xylem-L6's code does what its own author believes synapse-l4 does — they can't catch a wrong assumption about the other repo's real behavior (fast-path extraction, the mirrored Judge thresholds, real Redis emission). Once synapse-l4's ComplianceDomain blocker was resolved, a real dev server was started and the actual fixture schedule run against it, reading synapse-l4's own /metrics endpoint (total_processed: 13, judge_rejections: 0, emit_failures: 0) as the source of truth instead of just Xylem-L6's own logs.

Extra: xylem-l6 · Decision: Verify Live, Not Just With Mocked Tests
See: docs/journal/xylem-l6-2026-07-17T2200-synapse-l4-integration.md
