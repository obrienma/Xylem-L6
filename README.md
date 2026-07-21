<p align="center">
  <img width="200" alt="Xylem-L6" src="assets/Xylem-L6-logo.png" />
</p>

**Xylem-L6** is a standalone TypeScript stream processor that ingests SaaS API activity — GitHub's public Events API live, and hand-authored Okta-shaped fixture data for on-demand windowing conditions — and computes stateful security signals over them — request velocity, failed-auth bursts, first-seen IP/device/user-agent, impossible travel, and scope escalation. It exists to close a gap in the wider Rhizome Risk suite: nothing else in the suite ([EventHorizon](https://github.com/obrienma/EventHorizon), [Sentinel-L7](https://github.com/obrienma/sentinel-l7), [Synapse-L4](https://github.com/obrienma/synapse-l4)) holds state across events, computes over a sliding time window, handles out-of-order arrival, or applies in-process backpressure. See [ADR 0001](docs/adr/0001-ingestion-target-stream-processor.md) for the full rationale.

> [!NOTE]
> **Status: Phase 7 complete — wired to Sentinel-L7 via Synapse-L4, verified end-to-end.** All four trackers — Phase 1's sliding-window velocity counter and Phase 2's first-seen IP tracker, impossible travel detector, and scope escalation tracker — checkpoint their combined state to a local JSON file after every event and restore it on startup (Phase 3). [ADR 0004](docs/adr/0004-sentinel-l7-sink-decision.md) fixed Sentinel-L7 as the eventual consumer; [ADR 0007](docs/adr/0007-integrate-via-synapse-l4-ingest-not-direct-to-sentinel.md) corrected the transport (Synapse-L4's `POST /ingest` as a second producer, not a direct Sentinel-L7 connection — ADR 0002's original MCP-endpoint description was factually wrong) and [ADR 0008](docs/adr/0008-synapse-l4-payload-mapping.md) fixed the payload contract. [ADR 0005](docs/adr/0005-fusion-function-max-of-signals.md)'s fusion function (`src/core/fusion.ts`) is implemented and, as of this phase, actually called — by `src/sinks/synapse-l4/`, an opt-in (`XYLEM_SYNAPSE_L4_ENABLED`) HTTP client. [ADR 0006](docs/adr/0006-tenant-label-on-api-activity-event.md)'s optional `tenant` field remains implemented, including its `fixture-replay` tenant-collision scenario. Verified live against a real Synapse-L4 dev server: all 13 fixture events reached Sentinel-L7's Redis stream via the deterministic fast path, zero Judge rejections, zero emit failures.

---

## 📋 Contents

- [📋 Contents](#-contents)
- [🧰 Stack](#-stack)
- [🚀 Running the Project](#-running-the-project)
- [🏗️ Architecture](#️-architecture)
  - [🔀 Pipeline Diagram](#-pipeline-diagram)
  - [🗂️ Provider Adapters](#️-provider-adapters)
- [📚 Docs](#-docs)
- [🗺️ Roadmap](#️-roadmap)
  - [📋 Planned Phases](#-planned-phases)
  - [🔭 Deliberately Deferred](#-deliberately-deferred)


## 🧰 Stack

**⚡ Core**

- **TypeScript + Zod:** Canonical `ApiActivityEvent` contract and provider-adapter inputs validated at runtime with Zod — chosen deliberately for interview relevance (upcoming backend TypeScript interview) and to close the suite's only backend-TS streaming gap. See [ADR 0001](docs/adr/0001-ingestion-target-stream-processor.md).
- **Two provider adapters behind one shared interface (`ActivityAdapter`), implemented:** `fixture-replay` (hand-authored sample schedule with a baseline, a burst, a gap, a late/out-of-order event, and — per [ADR 0006](docs/adr/0006-tenant-label-on-api-activity-event.md) — a second synthetic tenant interleaved via a colliding actor id — controllable per-event delay and jitter) and `github-events-live` (GitHub's public Events API, polled against a real account, deduped by event id). Okta's System Log API is a deferred third candidate.
- **In-memory sliding-window velocity counter (`src/core/window.ts`):** event-time-driven, not wall-clock-driven — a per-actor watermark governs retention so a late-arriving event doesn't lose data recorded after it. Retains `2 × windowMs` of history to correctly answer a late event's own trailing window; an event later than one full `windowMs` behind the watermark falls outside that bound and may be undercounted (a known, documented Phase 1 limitation — a real "allowed lateness" config is Phase 2+).
- **Three Phase 2 running-state signals** — a different shape of state than Phase 1's window: no eviction, just a per-actor seen-set or single last-known point.
  - **First-seen IP tracker (`src/core/firstSeen.ts`):** per-actor `Set` of source IPs seen so far; flags an event from an IP not previously seen for that actor, including (by design) the actor's very first observed IP.
  - **Impossible travel detector (`src/core/impossibleTravel.ts`):** per-actor last-known `(lat, lon, timestamp)`; flags a new geo-tagged event if the implied speed from the previous point exceeds a configurable plausible-travel threshold (haversine great-circle distance ÷ time delta).
  - **Scope escalation tracker (`src/core/scopeEscalation.ts`):** per-actor `Set` of scopes ever exercised; flags a scope appearing for the first time — but only once the actor already has a baseline, so the very first event establishes scopes rather than "escalating" into them.
- **Checkpointing (`src/core/checkpoint.ts`, Phase 3):** each of the four trackers above exposes `getState()`/`loadState()`, exporting its internal `Map`/`Set` state as plain JSON-serializable data. `CheckpointStore` bundles all four into one versioned JSON file (`.xylem-checkpoint.json`, gitignored — local disk only, not the Phase 4+ GCP Firestore target), saved via a single `checkpoint.save()` call site after every event and restored on startup if present. Checkpointing every event, rather than on an interval, keeps the store always current with no debouncing/dirty-flag logic — the right tradeoff at this project's demo-scale throughput.
- **Fusion function (`src/core/fusion.ts`, [ADR 0005](docs/adr/0005-fusion-function-max-of-signals.md)):** pure function, no tracker state of its own. Normalizes each of the four signals independently to a severity in `[0, 1]` — boolean signals (first-seen IP, scope escalation) fire at `1.0`; continuous signals (velocity, impossible-travel speed) scale by the same thresholds `index.ts` uses for its console bracket flags (`src/core/thresholds.ts`, the single source of truth for both) — and returns the max of the four, which signal(s) produced it, and (per [ADR 0008](docs/adr/0008-synapse-l4-payload-mapping.md)) `firedCount`: how many signals fired at all, recovering the co-occurrence information max-of-signals scoring discards without changing the score itself. Called for the first time in Phase 7, by the Synapse-L4 sink below.
- **Synapse-L4 sink (`src/sinks/synapse-l4/`, [ADR 0007](docs/adr/0007-integrate-via-synapse-l4-ingest-not-direct-to-sentinel.md) / [ADR 0008](docs/adr/0008-synapse-l4-payload-mapping.md)):** the egress counterpart to `src/adapters/` — kept out of `src/core/` so `fusion.ts` and the four trackers stay free of I/O. POSTs each event's fused score to Synapse-L4's `/ingest` as a second producer alongside EventHorizon, not to Sentinel-L7 directly: `source_id` is the event's own `id`, `status` is derived from `score` using Synapse-L4's own Judge thresholds (`0.8`/`0.5`, mirrored — no cross-language import exists), `metric_value` is `firedCount`, `domain` is the constant `"saas"`. Uses Node's native `fetch`, no new dependency. Opt-in via `XYLEM_SYNAPSE_L4_ENABLED` (default off, base URL via `SYNAPSE_L4_URL`) so the default demo stays zero-dependency; send failures are logged and the event loop continues, no retry.

**🧪 Testing & Dev**

- **Vitest:** Test runner — `tests/` mirrors `src/`, colocated by module. 71 tests covering the schema, the velocity counter (including the late/out-of-order case), the three Phase 2 signal trackers, the Phase 3 checkpoint store, state round-trips for all four trackers, the fusion function (dataset-driven over signal combinations, boundary/tie/`firedCount` cases), the ADR 0006 tenant collision scenario, the Synapse-L4 sink's payload mapping and error handling (`fetchImpl` mocked, never a real network call), both adapters (GitHub calls similarly mocked), and a domain-isolation arch test (`tests/arch.test.ts`).
- **tsx:** Runs TypeScript directly in dev without a separate build step.

**☁️ Deployment (planned, Phase 4+)**

- **GCP Pub/Sub** as the ingestion transport, replacing adapter-level polling.
- **GCP Firestore** as the checkpoint store's eventual backing store, replacing the local JSON file Phase 3 uses — enables restart survival across ephemeral GKE pods, not just a single machine's disk.
- **GKE**, in the same shared-cluster namespace pattern already used by EventHorizon and Rhizome Lens.
- Deployment target is GCP, not Railway — see [ADR 0003](docs/adr/0003-gcp-deployment-target.md) for the full reasoning, including the credits-vs-Always-Free distinction.


## 🚀 Running the Project

### ✅ Prerequisites

- **Node.js 24+** with npm
- A **GitHub personal access token** (no special scope needed) — only required for the `github-events-live` adapter; `fixture-replay` needs nothing.

### ⚡ Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Type-check
npx tsc --noEmit

# 3. Run the test suite
npm test

# 4. Run the demo against fixture-replay (default, no credentials needed)
npm run dev

# 5. Or run it against real live GitHub activity
XYLEM_ADAPTER=github-events-live GITHUB_USERNAME=<you> GITHUB_TOKEN=<token> npm run dev

# 6. Or send fused scores to a locally-running Synapse-L4 (see its own README to start it)
XYLEM_SYNAPSE_L4_ENABLED=true npm run dev   # SYNAPSE_L4_URL to override the http://localhost:8000 default
```

`npm run dev` prints one line per event: timestamp, tenant, actor, action, and the current sliding-window velocity for that actor, flagging `[VELOCITY BREACH]` at 3+ events in the window, `[FIRST-SEEN IP ...]` on a new source IP for that actor, `[IMPOSSIBLE TRAVEL ...km/h]` on a geo-implausible jump, and `[SCOPE ESCALATION ...]` on a new scope after a baseline is established, plus the fused `score`/`fired` count (ADR 0005/0008) for every event regardless of whether any flag fired. State checkpoints to `.xylem-checkpoint.json` after every event (override the path with `XYLEM_CHECKPOINT_FILE`) and is restored on the next run — printing `(resumed from checkpoint)` on startup when it finds one. Delete that file to start fresh. The Synapse-L4 sink is opt-in and off by default — without it, this is still a self-contained demo with no external dependency.


## 🏗️ Architecture

### 🔀 Pipeline Diagram

```mermaid
flowchart LR
    subgraph Adapters
        F["fixture-replay"]
        G["github-events-live"]
        O["Okta System Log\n(deferred)"]
    end
    subgraph Core
        E[ApiActivityEvent\nZod-validated]
        W["SlidingWindowVelocityCounter"]
    end
    subgraph Signals
        V["Velocity"]
        FS["First-seen IP"]
        IT["Impossible Travel"]
        SE["Scope Escalation"]
    end
    subgraph Checkpoint
        CP["CheckpointStore\n(local JSON)"]
    end
    subgraph Fusion
        FN["fuseSignals()"]
    end
    subgraph Sink
        SY["Synapse-L4 POST /ingest"]
        S7["Sentinel-L7"]
    end

    F --> E
    G --> E
    O -.->|deferred| E
    E --> W
    E --> FS
    E --> IT
    E --> SE
    W --> V
    W --> CP
    FS --> CP
    IT --> CP
    SE --> CP
    CP -.->|restore on startup| W
    V --> FN
    FS --> FN
    IT --> FN
    SE --> FN
    FN --> SY
    SY --> S7
```

No sink was assumed at Phase 1–3 — the pipeline ended at signal computation until the Phase 4 decision was made. [ADR 0002](docs/adr/0002-sentinel-l7-integration-direction.md) recorded a forward-looking direction toward Sentinel-L7 without committing to it; [ADR 0004](docs/adr/0004-sentinel-l7-sink-decision.md) converted that direction into the committed Phase 4 sink, without specifying transport. [ADR 0007](docs/adr/0007-integrate-via-synapse-l4-ingest-not-direct-to-sentinel.md) fixed the transport as Synapse-L4's `POST /ingest` — not a direct Sentinel-L7 connection, correcting ADR 0002's original (wrong) claim that Synapse-L4 talks to Sentinel-L7 over an MCP endpoint — and [ADR 0008](docs/adr/0008-synapse-l4-payload-mapping.md) fixed the payload contract. The Sink is real and opt-in (`XYLEM_SYNAPSE_L4_ENABLED`), verified end-to-end against a live Synapse-L4 dev server: every fixture event reached Sentinel-L7's Redis stream via the deterministic fast path.

### 🗂️ Provider Adapters

| Adapter | Source | Purpose |
| :--- | :--- | :--- |
| `fixture-replay` | Static/hand-authored sample events | The only adapter that can reliably force specific windowing conditions on demand — a late/out-of-order event, a burst, a gap — that a live source can't be made to produce on request. |
| `github-events-live` | GitHub public Events API (`GET /users/{username}/events`) | Genuine live traffic from a real account. Narrower in shape than a true audit log — public activity only, no auth/session-level events — so impossible-travel and failed-auth-burst signals aren't demonstrable against it. |
| Okta System Log API | _Deferred_ | The one candidate provider whose schema is genuinely audit-log-shaped (auth/session events); would close the live-adapter gap `github-events-live` leaves for impossible-travel and failed-auth-burst signals. |


## 📚 Docs

| File | Contents | Last updated |
| --- | --- | --- |
| [README.md](README.md) | Project overview | 2026-07-13 |
| [ADR 0001](docs/adr/0001-ingestion-target-stream-processor.md) | Ingestion target (SaaS API activity) and standalone stream-processor architecture | 2026-07-13 |
| [ADR 0002](docs/adr/0002-sentinel-l7-integration-direction.md) | Sentinel-L7 integration direction — forward-looking, not committed | 2026-07-13 |
| [ADR 0003](docs/adr/0003-gcp-deployment-target.md) | GCP as deployment target (Pub/Sub, Firestore, GKE) | 2026-07-13 |
| [ADR 0004](docs/adr/0004-sentinel-l7-sink-decision.md) | Phase 4 sink decision — Sentinel-L7, committed direction, no integration built | 2026-07-14 |
| [ADR 0005](docs/adr/0005-fusion-function-max-of-signals.md) | Fusion function — max-of-signals, chosen over weighted-sum for lack of signal-history/label data; implemented (`src/core/fusion.ts`), no consumer yet | 2026-07-14 |
| [ADR 0006](docs/adr/0006-tenant-label-on-api-activity-event.md) | Optional `tenant` field on `ApiActivityEvent`, prompted by Ledger-L5's customer-attribution gap; implemented, incl. a fixture scenario demonstrating the single-tenant tracker-keying limitation | 2026-07-16 |
| [ADR 0007](docs/adr/0007-integrate-via-synapse-l4-ingest-not-direct-to-sentinel.md) | Integration transport corrected: Synapse-L4's `POST /ingest` as a second producer, not a direct Sentinel-L7 connection — supersedes ADR 0004's implicit framing, corrects ADR 0002's MCP-endpoint claim | 2026-07-17 |
| [ADR 0008](docs/adr/0008-synapse-l4-payload-mapping.md) | Synapse-L4 payload contract: `source_id`/`status`/`metric_value`/`domain` mapping from fused score; implemented (`src/sinks/synapse-l4/`) and verified end-to-end. 2026-07-18 addendum: decides a conditional `tenant` field on the payload — not yet implemented, and doesn't by itself reach Sentinel-L7 (Synapse-L4's own models don't accept it yet) | 2026-07-18 |
| [journal/](docs/journal/) | Engineering journal — one entry per phase, paired with Anki probes in [probes/](docs/probes/) | 2026-07-17 |
| [USER_STORIES.md](docs/USER_STORIES.md) | User stories by domain (ingestion, signal detection, multi-tenancy, resilience, downstream delivery, platform ops), each tagged implemented/aspirational/deferred against the actual codebase and ADRs | 2026-07-18 |


## 🗺️ Roadmap

### 📋 Planned Phases

Per [ADR 0001](docs/adr/0001-ingestion-target-stream-processor.md), each phase is independently demoable:

* [x] **Phase 1** — canonical `ApiActivityEvent` Zod schema, both adapters (`fixture-replay` and `github-events-live`) behind a shared interface, in-memory sliding-window velocity counter. No persistence, no external hookup.
* [x] **Phase 2** — stateful signals that need running state rather than a window-only counter: first-seen IP tracker, impossible travel detector, scope escalation tracker (see [ADR 0001 addendum](docs/adr/0001-ingestion-target-stream-processor.md#addendum-2026-07-13-post-phase-1) for why scope escalation is in scope). First-seen tracking is IP-only for now — device/user-agent isn't in the `ApiActivityEvent` schema and no adapter currently supplies it.
* [x] **Phase 3** — checkpointing, so a process restart doesn't silently drop in-flight window/state. Each tracker exports/imports its state via `getState()`/`loadState()`; `CheckpointStore` persists all four to a single local JSON file after every event and restores it on startup.
* [x] **Phase 4** — sink decision, made deliberately by ADR when reached (not assumed in advance): [ADR 0004](docs/adr/0004-sentinel-l7-sink-decision.md) fixes the sink as Sentinel-L7, and [ADR 0005](docs/adr/0005-fusion-function-max-of-signals.md) fixes the fusion function as max-of-signals. Decisions only — no integration code; a policy-corpus ADR (Sentinel-L7 side) is still required before wiring.
* [x] **Phase 5** — [ADR 0006](docs/adr/0006-tenant-label-on-api-activity-event.md) adds an optional `tenant` field to `ApiActivityEvent`, closing a customer-attribution gap surfaced by Ledger-L5's billing contract. Implemented: schema field, plus a `fixture-replay` scenario (`evt-11`..`evt-13`) interleaving a second synthetic tenant (`globex`) with a colliding actor id, demonstrating — not fixing — the single-tenant tracker-keying limitation (a real velocity breach produced by combining two tenants' events under one actor id). Tracker keying stays `actor.id`-only; composite-keying is deferred until a second real tenant exists. Not anticipated by [ADR 0001](docs/adr/0001-ingestion-target-stream-processor.md)'s original phase plan — new scope, not a Phase 4 correction, hence its own phase number rather than an addendum.
* [x] **Phase 6** — [ADR 0005](docs/adr/0005-fusion-function-max-of-signals.md)'s fusion function is implemented (`src/core/fusion.ts`, `fuseSignals`): a pure function normalizing the four signals to `[0, 1]` severities and returning their max plus which signal(s) produced it. `VELOCITY_BREACH_THRESHOLD`/`MAX_PLAUSIBLE_SPEED_KMH` moved to `src/core/thresholds.ts` so `index.ts` and `fusion.ts` share one source of truth. Numbered after Phase 5 by build order, even though ADR 0005 predates ADR 0006 — phase numbers track when work was implemented, not when the ADR was authored.
* [x] **Phase 7** — Xylem-L6 is wired to Sentinel-L7. Working out the actual transport surfaced that ADR 0002's "Synapse-L4 talks to Sentinel-L7 over its MCP endpoint" claim was factually wrong (it's a direct Redis `XADD`, no MCP anywhere); [ADR 0007](docs/adr/0007-integrate-via-synapse-l4-ingest-not-direct-to-sentinel.md) corrected course to Synapse-L4's `POST /ingest` as a second producer alongside EventHorizon, and [ADR 0008](docs/adr/0008-synapse-l4-payload-mapping.md) fixed the payload contract (`source_id` = event's own `id`; `status` from `score` via Synapse-L4's own Judge thresholds; `metric_value` = `fuseSignals()`'s new `firedCount`; `domain` = `"saas"`). Implemented as `src/sinks/synapse-l4/`, opt-in via `XYLEM_SYNAPSE_L4_ENABLED`, and called from `index.ts` — `fuseSignals()`'s first real caller. Verified live against a running Synapse-L4 dev server, once its `ComplianceDomain` Literal was extended with `"saas"` (a cross-repo prerequisite ADR 0008 named but didn't resolve): all 13 fixture events reached Sentinel-L7's Redis stream via the deterministic fast path — zero extraction failures, zero Judge rejections, zero emit failures.
* [ ] **Phase 8** — migrate `CheckpointStore` off the local JSON file onto **Firestore**, per [ADR 0003](docs/adr/0003-gcp-deployment-target.md)'s Decision ("Firestore for checkpoint state... small, cheap, and the right shape for a window checkpoint"). ADR 0003 is still `Proposed`, not `Accepted` — same posture ADR 0002 was in before ADR 0007/0008 committed it — and nothing is built yet. Scoped to the checkpoint store specifically; ADR 0003's other two decisions (Pub/Sub for ingestion, GKE for compute) are separate and not part of this phase. Not started.

### 🔭 Deliberately Deferred

* **Okta System Log adapter** — the genuinely audit-log-shaped provider (auth/session events); would unlock live impossible-travel and failed-auth-burst signal demos. Not started.
* **First-seen device/user-agent tracking** — `FirstSeenIpTracker` (Phase 2) covers source IP only; device/UA would need a new `ApiActivityEvent` field neither adapter currently populates, so it wasn't added speculatively.
* **Failed-auth-burst signal** — named in ADR 0001's full signal set but not scoped into Phase 2 by the ADR's build order or its addendum; would need auth-event data neither adapter reliably carries today (see the `github-events-live` row above).
* **GCP deployment, Pub/Sub and GKE specifically** — architecturally decided ([ADR 0003](docs/adr/0003-gcp-deployment-target.md)) but not built. Firestore (the third piece of that same ADR) now has its own roadmap slot as Phase 8, above.
* **Synapse-L4 sink always-on by default** — deliberately left opt-in (`XYLEM_SYNAPSE_L4_ENABLED`, Phase 7) rather than default-on, so `npm run dev` stays a zero-dependency demo unless a Synapse-L4 instance is actually running. No auth exists on Synapse-L4's `POST /ingest` today either (confirmed in ADR 0008) — revisit both if this integration runs anywhere beyond local dev.
* **Judge-threshold drift risk between Xylem-L6 and synapse-l4** — `src/sinks/synapse-l4/index.ts` mirrors `synapse-l4/src/evaluation/rules.py`'s `0.8`/`0.5` thresholds as TypeScript literals, since no cross-language import exists between the two repos. Accepted per ADR 0008's Consequences; no contract-testing mechanism exists to catch drift if Synapse-L4's thresholds change.
* **Composite tracker keying (`tenant:actor.id`)** — deliberately not done. [ADR 0006](docs/adr/0006-tenant-label-on-api-activity-event.md) added the `tenant` field and a fixture scenario that demonstrates the resulting false-positive risk (two tenants sharing an actor id), but the trackers themselves stay `actor.id`-only until a second real tenant enters the system — composite-keying now would be speculative complexity against a hypothetical, not a real, collision.
* **`tenant` on the Synapse-L4 payload** — [ADR 0008's 2026-07-18 addendum](docs/adr/0008-synapse-l4-payload-mapping.md#addendum-2026-07-18--tenant-field) decides `buildIngestPayload()` should conditionally include `event.tenant`, but `src/sinks/synapse-l4/index.ts` doesn't yet — decision recorded ahead of implementation, same split as ADR 0004/0005. Even once implemented here, Synapse-L4's own `RawTelemetry`/`AxiomDraft`/`Axiom` models don't accept or forward the field yet, so Sentinel-L7 ADR-0031's tenant-label passthrough stays unmet until that separate, cross-repo ADR lands too.
