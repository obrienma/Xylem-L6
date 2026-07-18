# ADR 0007 — Integration Target: Synapse-L4's `POST /ingest`, Not Sentinel-L7 Directly

**Status:** Accepted
**Date:** 2026-07-17

---

## Context

ADR 0004 named Sentinel-L7 as Xylem-L6's Phase 4 sink and fixed that destination, without examining the transport — how an Axiom would actually get there. Working through that transport question surfaced two things ADR 0004 didn't have in view:

**First, ADR 0002's description of the existing precedent is wrong.** It says the interface should "follow the pattern Synapse-L4 already established with `Axiom`: a typed, immutable contract over Sentinel-L7's existing MCP endpoint." That's not what Synapse-L4 does. Its actual client (`synapse-l4/src/clients/sentinel.py`) delivers Axioms by calling `redis.xadd()` directly on Sentinel-L7's `synapse:axioms` stream — no HTTP call, no MCP, anywhere in that path or its tests. Sentinel-L7's MCP server (`app/Mcp/Servers/SentinelServer.php`) exposes exactly three tools — `analyze_transaction`, `search_policies`, `get_recent_transactions` — all read/analysis tools for an AI agent to query Sentinel-L7, none of them an Axiom-ingestion path. ADR 0002's underlying principle (reuse the existing pattern rather than inventing a second integration shape) was right; its description of what that pattern *is* was not.

**Second, following the actually-correct mechanism (direct Redis `XADD`, matching `sentinel.py`'s flat-field contract) would mean building a second, independent copy of everything Synapse-L4 already is.** Concretely, to write directly to Sentinel-L7 the way ADR 0004 implies, Xylem-L6 would need: a Redis client and Upstash credentials it doesn't have (`package.json` has exactly one dependency, `zod`); its own implementation of the exact flat-field `XADD` wire shape (`status`, `metric_value`, `anomaly_score`, `source_id`, `emitted_at`, `domain`) with no existing reference inside this codebase to keep it correct; its own W3C trace-context propagation, duplicating what `synapse-l4`'s emitter already does; and its own notion of which `domain` values are valid, duplicating a check that already exists as `synapse-l4/src/models/axiom.py`'s `ComplianceDomain` Literal.

**Synapse-L4 already exists to be the thing that absorbs exactly this.** Per its own architecture, it sits structurally between EventHorizon (raw telemetry) and Sentinel-L7 (compliance engine) for exactly this reason. Its `POST /ingest` (Stage 1 — Consume) accepts a raw payload from any producer. Stage 2 (Extract) has a **deterministic fast path**: if the payload already contains valid `status`, `metric_value`, `anomaly_score` (and `domain`), those fields are used directly — the LLM (Instructor-constrained) fallback fires only for unstructured input. Xylem-L6's fusion output (ADR 0005 — max-of-signals, a pure function over four already-computed severities) is exactly this deterministic, pre-structured shape. Stage 3 (Evaluate/Judge) then runs a deterministic cross-field business-rule check — e.g., `anomaly_score > 0.8` requires `status == "critical"` — before Stage 4 emits to Sentinel-L7 via the same tested Redis path it already uses for EventHorizon-sourced Axioms.

Nothing has shipped on either side of this integration — no Redis client, no `fusion.ts`, no HTTP client exist in Xylem-L6 today. There is no migration cost to correcting the target now; there would be real cost to building the direct-to-Redis path first and discovering this later.

## Decision

**Xylem-L6 integrates by calling Synapse-L4's `POST /ingest`, structurally as a second producer alongside EventHorizon — not by writing to Sentinel-L7's Redis stream directly.** Sentinel-L7 remains the eventual consumer and policy-decision engine; nothing about *that* changes. What changes is that Xylem-L6 never holds Sentinel-L7 Redis credentials and never implements the wire contract itself — it hands its fusion-function output to Synapse-L4 exactly as EventHorizon does, and Synapse-L4's existing Consume → Extract → Evaluate → Emit pipeline does the rest.

**This supersedes ADR 0004's implicit framing.** ADR 0004's decision ("Xylem-L6's Phase 4 sink is Sentinel-L7") is not reversed as a business outcome — Sentinel-L7 is still where this data is ultimately evaluated for compliance risk — but its unstated assumption that Xylem-L6 would reach Sentinel-L7 directly is corrected. ADR 0004's status is updated to point here.

**Payload shape sent to `POST /ingest`:** the four fields Synapse-L4's fast path reads — `status`, `metric_value`, `anomaly_score`, `domain` — computed from Xylem-L6's fusion function (ADR 0005) plus the literal `domain: "saas"`, constant across every event this integration emits (it identifies which Sentinel-L7 policy corpus applies to the whole integration, not something derived per-event). `source_id` and `emitted_at` are Synapse-L4 emitter responsibilities per its existing idempotent-emission pattern, not Xylem-L6's to set directly — matching how it already treats EventHorizon input.

## Rationale

**Credential and blast-radius containment.** In a system meant to analyze real customer traffic, minimizing the number of systems that independently hold write credentials into Sentinel-L7's core stream is a real security property, not a style preference. Today exactly one system (Synapse-L4) holds that credential. Direct-to-Redis would make it two, for a codebase (Xylem-L6) whose own ADR 0001 frames it as a learning project, not a hardened production client.

**No duplicated wire contract.** One implementation of the flat-field `XADD` shape, one implementation of trace propagation, one definition of valid `domain` values (`synapse-l4/src/models/axiom.py`'s `ComplianceDomain` Literal) — all owned by the system that already owns them, rather than a second copy in TypeScript that has to be kept in sync by hand.

**Free correctness guard for a customer-facing system.** Synapse-L4's Judge pass is a deterministic, no-LLM-cost cross-validation of Xylem-L6's fusion output before it reaches Sentinel-L7's paid AI-analysis pipeline (ADR-0028 on Sentinel-L7's side treats AI calls as billable). Catching an inconsistent event before it's billed and acted on is a concrete cost/correctness benefit, not just defense-in-depth for its own sake.

**No latency cost from the deterministic fast path.** The intuitive objection — "routing through an LLM judge pipeline is slower" — doesn't hold for this specific payload shape. Fusion output is already structured, so it takes Synapse-L4's fast path and never touches the LLM.

## Alternatives Considered

| Option | Pro | Con |
|---|---|---|
| **Direct Redis `XADD` to Sentinel-L7 (ADR 0004's implicit path)** | One fewer network hop; no dependency on Synapse-L4's uptime | Requires Xylem-L6 to hold Sentinel-L7 Redis credentials and independently reimplement the wire contract, trace propagation, and domain validation Synapse-L4 already owns; duplicates rather than reuses |
| **Call Synapse-L4's `POST /ingest` (chosen)** | Reuses an existing, tested gateway; no new credentials in Xylem-L6; gets the Judge pass's business-rule check for free; fast path avoids LLM cost for structured input | Synapse-L4's uptime becomes a shared dependency for every producer, including Xylem-L6; per its own failure-mode table, if it's down, Axioms are not partially emitted (502) |
| **Build a bespoke HTTP endpoint on Sentinel-L7 for Xylem-L6 specifically** | Avoids the Synapse-L4 dependency entirely | Exactly the "bespoke second integration shape invented for a second domain" ADR 0002 already argued against — and still requires new credential/auth surface on the Sentinel-L7 side that doesn't exist today |

## Consequences

- **ADR 0004 is superseded**, not reversed as a business outcome — see its updated status line.
- **ADR 0002's mechanism description needs correcting.** Its "over Sentinel-L7's existing MCP endpoint" line is factually wrong about how Synapse-L4 integrates today; its status line is amended to note this without rewriting its (still-valid) underlying reasoning.
- **`synapse-l4/src/models/axiom.py`'s `ComplianceDomain` Literal must add `"saas"`** before any Axiom from this integration validates — a one-line change, but a real blocker, and it belongs in Synapse-L4's repo since that's the single source of truth for valid domain values. Not resolved by this ADR.
- `src/core/fusion.ts` (`fuseSignals()`) now exists, implementing ADR 0005's max-of-signals decision — built in Phase 6, before this ADR, with no awareness of the Synapse-L4-vs-direct-to-Sentinel-L7 question decided here. Per its own commit message it's deliberately not called from `index.ts` or anywhere else yet ("no consumer until Sentinel-L7 wiring exists" — ADR 0005's own Consequences). What's still missing, regardless of transport, is the wiring itself: nothing calls `fuseSignals()`, and no HTTP client exists to call `POST /ingest` — smaller than a Redis client + credentials would have been, but still new work.
- No `source_id` scheme has been decided on the Xylem-L6 side. Deferred — Synapse-L4's Consume/Extract stages may not require Xylem-L6 to mint one itself the way direct Redis emission would have; revisit once the actual `POST /ingest` request shape is designed.
