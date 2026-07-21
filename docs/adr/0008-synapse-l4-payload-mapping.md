# ADR 0008 — Synapse-L4 `POST /ingest` Payload Mapping

**Status:** Accepted
**Date:** 2026-07-17

---

## Context

ADR 0007 fixed the transport target — Xylem-L6 calls Synapse-L4's `POST /ingest` as a second producer, not Sentinel-L7 directly — but stopped short of a complete request contract. Reading the actual `synapse-l4` code it decided to depend on (`src/models/axiom.py`, `src/api/ingest.py`, `src/nodes/extractor.py`, `src/nodes/emitter.py`, `src/evaluation/rules.py`) surfaced three gaps ADR 0007 didn't have in view:

**`source_id` is not a Synapse-L4 responsibility, contrary to ADR 0007's Decision text.** `RawTelemetry` (`src/models/axiom.py`) requires `source_id: str` as a caller-supplied field on the `POST /ingest` body itself. Only `emitted_at` is auto-stamped, by `emitter.py`, at the moment of delivery — `source_id` is authoritative from the request, never invented downstream. ADR 0007's own Consequences section already flagged this as undecided ("No `source_id` scheme has been decided... deferred"); its Decision section's claim otherwise was simply wrong.

**Fusion output doesn't map 1:1 onto the fast path's three fields.** `_try_direct_extraction()` (`extractor.py`) wants `status`, `metric_value`, `anomaly_score` directly on `payload`. Xylem-L6's fusion function (ADR 0005) produces `{ score: number, signals: FusionSignal[] }`. `anomaly_score = score` is immediate — both are `[0, 1]` by construction. `status` and `metric_value` have no existing mapping.

**`domain: "saas"` would silently be dropped today, not rejected.** `ComplianceDomain` (`axiom.py`) is `Literal["aml", "gdpr", "hipaa"]`, and `extractor.py`'s `_valid_domain()` returns `None` for anything outside that set rather than raising — so a well-formed request with `domain: "saas"` gets a `200` back with the domain quietly gone, defeating the point of Sentinel-L7 ADR-0032's domain-scoped retrieval. ADR 0007 already named this as a real blocker; it remains unresolved.

## Decision

**`source_id` is the triggering `ApiActivityEvent.id`, unchanged.** Mirrors Synapse-L4's own EventHorizon client (`src/clients/eventhorizon.py`'s `_event_to_telemetry`, which uses the raw event's own `id`). No second identifier scheme is invented for a value that already exists and is already unique per adapter.

**`status` is derived from `score` using Synapse-L4's own Judge thresholds, not a new set:** `score >= 0.8` (`ANOMALY_CRITICAL_THRESHOLD`) → `"critical"`; `score >= 0.5` (`ANOMALY_DEGRADED_THRESHOLD`) → `"degraded"`; otherwise `"nominal"`. Reusing `rule_anomaly_score_status_consistency`'s own constants (`synapse-l4/src/evaluation/rules.py`) guarantees every Xylem-L6-sourced event passes Synapse-L4's Judge pass by construction — the same "reuse the existing threshold, don't invent a parallel one" pattern ADR 0005 already established for `index.ts`'s console flags.

**`metric_value` is the count of signals with nonzero severity (0–4), not a restatement of `score`.** `fuseSignals()` (`src/core/fusion.ts`) gains a fourth return field, `firedCount`, computed from the same four per-signal severities it already calculates internally and previously discarded once the max was taken. This does not change ADR 0005's scoring — the score is still a strict max, untouched. It recovers, for a downstream reader, exactly the co-occurrence information ADR 0005's Rationale named as max-of-signals' deliberately-accepted weakness ("a single strongly-fired signal and four simultaneously weak ones score identically"). It doesn't fix that weakness in the score; it makes the discarded computation visible to whoever reads `metric_value`.

**`domain` is the literal `"saas"`, constant across every event**, per ADR 0007.

**Every event is sent, not only events with `score > 0`.** Synapse-L4's EventHorizon client enqueues every WebSocket message unconditionally — no severity gate exists anywhere in `src/clients/eventhorizon.py`. Filtering here would be an undocumented policy Xylem-L6 would own with no existing precedent to justify it. It also costs nothing extra: the deterministic fast path means a `"nominal"` event never touches the LLM any more than a `"critical"` one does (ADR 0007's Rationale).

**The client is a new module, `src/sinks/synapse-l4/index.ts`** — not `src/core/` — mirroring `src/adapters/<name>/index.ts`'s per-provider directory convention but for egress, keeping `fusion.ts` and the four trackers free of I/O per ADR 0001's Domain Logic Isolation. Uses Node's native `fetch` — no new dependency (`package.json` has exactly one today, `zod`). Base URL is configurable via `SYNAPSE_L4_URL`, defaulting to `http://localhost:8000` to match `synapse-l4`'s own README dev-server instructions.

**Errors (network failure, non-2xx) are logged and the event loop continues — no retry, no circuit breaker.** Matches `synapse-l4`'s own stated precedent for its EventHorizon consumer ("one bad event must never crash the consumer loop") and this project's standing posture against building error handling for scenarios not actually exercised.

**Not resolved by this ADR, and blocking:** `synapse-l4/src/models/axiom.py`'s `ComplianceDomain` Literal and `extractor.py`'s `_VALID_DOMAINS` frozenset both need `"saas"` added before any event from this integration validates with its domain intact. One line in each of two files, in a different repo — tracked here as a prerequisite, not authorized here as a change to anywhere else in `synapse-l4`.

## Rationale

Reusing existing identifiers and thresholds — `source_id` from `event.id`, `status` thresholds from the Judge's own constants — rather than inventing new ones keeps exactly one definition of each concept in the combined system. This is the same pattern this project has used every time the question has come up: ADR 0005 reused `index.ts`'s demo thresholds instead of a second set for fusion; ADR 0007 reused Synapse-L4's existing pipeline instead of rebuilding a Redis client from scratch.

Not gating on `score > 0` mirrors the one existing producer's actual behavior rather than assuming Xylem-L6 should behave differently without a stated reason to.

Surfacing `firedCount` as `metric_value` turns a previously-discarded computation into a real, read one — without touching ADR 0005's scoring decision. That respects the decision instead of quietly relitigating it through a side channel in the same function.

## Alternatives Considered

| Option | Pro | Con |
|---|---|---|
| `metric_value = score` (again) | Trivial | Redundant with `anomaly_score`; throws away information (`firedCount`) that's already computed and free |
| `metric_value` = raw velocity count, always | Reuses an existing number | Meaningless when velocity isn't the winning signal — a pure scope-escalation event would report `metric_value: 1` as if that were its "metric" |
| Only send events with `score > 0` | Fewer requests | No precedent in Synapse-L4's own EventHorizon client, which forwards unconditionally; loses baseline `"nominal"` visibility; saves nothing given the fast path's zero LLM cost either way |
| Generate a new `source_id` (e.g. a UUID) at the Xylem-L6 boundary | Decouples from `ApiActivityEvent.id`'s shape | `event.id` already exists and is already unique per adapter; inventing a second identifier duplicates identity for no reason — the same anti-pattern ADR 0006 avoided for `tenant` |

## Consequences

- `fuseSignals()`'s return type (`FusedScore`) gains `firedCount: number` — additive, not breaking; existing `score`/`signals` assertions in `tests/core/fusion.test.ts` remain valid, and new assertions are needed for `firedCount`.
- A new `src/sinks/synapse-l4/index.ts` and its wiring into `index.ts` (calling `fuseSignals()` for the first time anywhere) are still to be implemented — this ADR decides the contract, not the code, consistent with ADR 0004/0005's decision-then-implementation split.
- ~~`synapse-l4`'s `ComplianceDomain` Literal and `extractor.py`'s mirrored frozenset need a `"saas"` addition before this integration is real.~~ **Resolved 2026-07-17** (later the same day this ADR was written): both now include `"saas"` (`axiom.py`'s `ComplianceDomain`, `extractor.py`'s `_VALID_DOMAINS`, and its LLM system prompt). This was the last named blocker on this ADR's Decision; `domain: "saas"` now survives `_valid_domain()` instead of being silently dropped.
- No auth exists on `POST /ingest` today (confirmed: no dependency/header check in `src/api/ingest.py` or `main.py`) — this ADR adds none, matching the endpoint's current pre-production posture. Revisit if `synapse-l4` adds auth before this integration runs anywhere beyond local dev.
- **The Rationale's "exactly one definition" claim has a real limit: the Judge thresholds still end up duplicated as TypeScript literals.** There is no mechanism to import a Python module's constants into a TypeScript one across repos, so `0.8`/`0.5` are copied into Xylem-L6's sink module as plain numbers, with a comment citing `synapse-l4/src/evaluation/rules.py` as the source of truth. If Synapse-L4's thresholds change, Xylem-L6's copy goes stale silently — a cross-language version of exactly the drift ADR 0005 mechanically eliminated within one codebase via `src/core/thresholds.ts`, but can't eliminate across two. Accepted because there's no cheaper fix available today; revisit if this integration graduates beyond a demo and a shared schema/contract-testing mechanism becomes worth building.

## Addendum (2026-07-18) — `tenant` field

ADR 0006 added an optional `tenant` field to `ApiActivityEvent` and demonstrated it via a real fixture collision, but explicitly left "whether and how it propagates into a structured output payload" undesigned. This ADR's payload mapping — written the next day — didn't include it either: `buildIngestPayload()` (`src/sinks/synapse-l4/index.ts`) maps `source_id`, `status`, `metric_value`, `anomaly_score`, and the constant `domain: "saas"`, but reads nothing from `event.tenant`. Sentinel-L7 ADR-0031 (tenant label passthrough on `compliance_events`) depends on this field reaching Synapse-L4's payload; as of this addendum it does not.

**`buildIngestPayload()` gains a conditional `tenant` field, mirroring how `domain` is handled on the receiving side (`SentinelClient.post_axiom`'s `if axiom.domain is not None`) rather than always present:**

```typescript
export interface SynapseIngestPayload {
  source_id: string;
  payload: {
    status: SynapseStatus;
    metric_value: number;
    anomaly_score: number;
    domain: "saas";
    tenant?: string;
  };
}

export function buildIngestPayload(event: ApiActivityEvent, fused: FusedScore): SynapseIngestPayload {
  return {
    source_id: event.id,
    payload: {
      status: statusFor(fused.score),
      metric_value: fused.firedCount,
      anomaly_score: fused.score,
      domain: "saas",
      ...(event.tenant !== undefined && { tenant: event.tenant }),
    },
  };
}
```

Conditional inclusion (not `tenant: event.tenant` unconditionally, which would send `tenant: undefined` as a JSON `null` or omit inconsistently depending on serialization) matches this codebase's existing pattern for optional passthrough fields and avoids sending a field Synapse-L4 doesn't yet expect from every request — relevant since `github-events-live`-sourced events, which have no `tenant`, will still call this same function.

**This addendum does not, by itself, make `tenant` reach Sentinel-L7.** Synapse-L4's `RawTelemetry`/`AxiomDraft`/`Axiom` models don't accept or forward it yet — that's a separate, new Synapse-L4 ADR, not this repo's to author. Until that lands, Synapse-L4's `_try_direct_extraction()` will simply ignore the extra `tenant` key in the request body (Pydantic ignores unknown dict keys read via `.get()`/`[...]` on `payload`, which is untyped `dict[str, Any]` at the Consume stage) — no error, but silently dropped, same failure mode ADR-0008's own Context section identified for `domain` before that gap was closed.

**Consequences addition:** `tests/sinks/synapse-l4.test.ts` needs a new assertion — a `tenant`-bearing event produces a payload with `tenant` present, and a `tenant`-less event (e.g. from `github-events-live`) produces a payload with the key absent, not `null`.
