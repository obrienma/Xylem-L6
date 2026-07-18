---
id: xylem-l6-2026-07-17T2200-synapse-l4-integration
repo: xylem-l6
title: "Xylem-L6 → Synapse-L4 → Sentinel-L7 Integration (ADR 0007/0008, wired and verified live)"
date: 2026-07-17
phase: 7
tags: [adr, decision-record, synapse-l4, sentinel-l7, cross-repo, fusion-function, http-client, end-to-end-test, credentials-boundary, scope-discipline]
files:
  - docs/adr/0007-integrate-via-synapse-l4-ingest-not-direct-to-sentinel.md
  - docs/adr/0008-synapse-l4-payload-mapping.md
  - src/core/fusion.ts
  - src/sinks/synapse-l4/index.ts
  - src/index.ts
  - tests/core/fusion.test.ts
  - tests/sinks/synapse-l4.test.ts
  - README.md
---

### Pattern: Re-Verifying a Just-Discovered ADR's Own Claims Before Building Against It
ADR 0007 had already landed by the time this phase started — real, careful work: it caught and corrected ADR 0002's factually wrong claim that Synapse-L4 talks to Sentinel-L7 "over its existing MCP endpoint" (actually a direct Redis `XADD`, no MCP anywhere in that path). That correction alone could easily read as "the transport question is now fully settled, safe to build directly against." It wasn't treated that way. Before writing a line of client code, `synapse-l4`'s actual source — `models/axiom.py`, `api/ingest.py`, `nodes/extractor.py`, `nodes/emitter.py`, `evaluation/rules.py` — was read directly, the same discipline ADR 0005's journal entry named for a different codebase. That read surfaced two more things ADR 0007's own Decision text got wrong or left open: `source_id` is a caller-supplied field on the `POST /ingest` request body, not a Synapse-L4 responsibility as ADR 0007 claimed; and there was no existing mapping at all from fusion's `{score, signals}` shape onto `status`/`metric_value`/`anomaly_score`.

### Anti-Pattern Avoided: Treating "Accepted" as "Nothing Left to Verify"
An ADR's `Accepted` status describes the state of a decision, not the correctness of every factual claim inside it — especially claims about a second repo's internals, which drift the moment that repo's code changes and nothing forces the ADR to notice. Skipping the direct code read because ADR 0007 was already Accepted and had already done real diligence would have produced a client built on an incorrect assumption about who owns `source_id`, discovered only when a live request either failed validation or silently misbehaved. Reading the actual Pydantic models cost minutes; discovering the mistake at runtime, or worse, silently (Pydantic would have just constructed an `AxiomDraft` from whatever showed up in `payload`, no loud failure) would have cost more.

### Challenge: The Line Between Verifying Code and Inspecting Credentials
Assessing whether a live end-to-end test was actually possible led to reaching for `ls .env` in `synapse-l4` — checking whether the file existed, not reading its contents. That tool call was rejected by the user. In hindsight the instinct wasn't wrong (verifying integration readiness is legitimate), but it crossed a line that reading `axiom.py` or `ingest.py` doesn't: those are application logic, safe to read freely as ADR-supporting evidence; `.env` is a credentials boundary, and "just checking existence" isn't obviously distinct from "checking what's configured" to someone watching the tool calls go by. The correct move — asking directly whether to proceed with starting the server, which the user then explicitly authorized — is what actually happened next, and is the right default going forward: verify code freely, ask before touching anything that could hold secrets, even just to check presence.

### Decision: metric_value Is firedCount, Not score Restated
Synapse-L4's fast path wants a `metric_value` float, and fusion output doesn't have an obvious one — `anomaly_score` already covers `score`. The choice was to expose `firedCount` (how many of the four signals fired at all, not just which tied for the max) instead of re-sending `score` or a signal-specific raw number like velocity count. This was picked because ADR 0005's own Rationale had already named, as a deliberately accepted weakness, that max-of-signals "collapses to the same score whether one signal fires strongly or all four fire weakly simultaneously" — `firedCount` is exactly the information that weakness discards, recovered without touching the scoring decision itself. It turns a previously-thrown-away internal computation into something a downstream reader can actually use, which is a stronger reason than "we need to put a number somewhere."

### Decision: The Sink Is Opt-In (XYLEM_SYNAPSE_L4_ENABLED), Not Default-On
Neither ADR 0007 nor ADR 0008 decided whether calling Synapse-L4 should be the default behavior of `npm run dev` or something a caller turns on. Left unresolved, the natural-feeling move once `fuseSignals()` had a real caller was to just wire it in unconditionally. That would have broken the project's standing "zero-dependency demo" property — anyone running `npm run dev` without a Synapse-L4 instance up would suddenly see a wall of send-failure log lines. Gating it behind an env var, mirroring exactly how `XYLEM_ADAPTER=github-events-live` already works, keeps the default path dependency-free while making the feature fully real and reachable with one flag.

### Decision: Write ADR 0008 Before Implementing, Per an Explicit Choice
Offered a choice between writing a short ADR to pin down the mapping decisions first versus making the same judgment calls inline in code, the deliberate choice was the ADR — consistent with every other cross-repo integration point in this project having gone through the same process. This wasn't the only reasonable option (inline comments could have captured the same reasoning faster), but it was picked explicitly rather than defaulted into, and it paid off directly: writing the ADR's Rationale section is what surfaced the cross-language threshold-duplication problem (`0.8`/`0.5` can't be imported from Python into TypeScript) as an honest, named Consequence rather than something quietly discovered later as unexplained drift.

### Decision: Verify Live, Not Just With Mocked Tests
`tests/sinks/synapse-l4.test.ts` mocks `fetchImpl` and never touches a real server — correct for unit tests, but insufficient proof that the actual `synapse-l4` pipeline (fast-path extraction, the mirrored Judge thresholds, real Redis emission) agrees with what Xylem-L6 assumes about it. Once the `ComplianceDomain` blocker was independently resolved on the `synapse-l4` side, the chosen path was starting a real `synapse-l4` dev server and running the actual fixture schedule against it, then reading its own `/metrics` endpoint and logs as the source of truth — not just checking that Xylem-L6 logged no errors. `total_processed: 13, judge_rejections: 0, emit_failures: 0` is evidence the two repos' assumptions about each other actually hold; a green mocked test suite alone would only have proven Xylem-L6's code does what its own author believes `synapse-l4` does.
