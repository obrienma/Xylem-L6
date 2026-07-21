# User Stories — Xylem-L6

Stories are organised by domain. Each story is marked with a status icon and a user-type icon.

**Status**
- ✅ **Implemented** — delivered in the current codebase
- 🔲 **Aspirational** — not yet built; a TODO exists in README and/or an ADR
- 🚫 **Deferred** — explicitly out of scope for this project; see the linked ADR

**User type**
- 🕵️ Security analyst — downstream consumer of the signals Xylem-L6 produces (works from Sentinel-L7's compliance dashboard, one hop past Xylem-L6 itself)
- 🔌 Downstream pipeline — Synapse-L4 / Sentinel-L7, the automated system(s) that receive Xylem-L6's output
- 🛠️ Platform engineer — operates, extends, and deploys Xylem-L6 itself

---

## 🔄 Event Ingestion & Adapters

- ✅ 🛠️ **Swap the event source without touching signal logic**
  - *As a platform engineer, I want every provider to implement one shared `ActivityAdapter` interface, so that adding or switching a source never requires changing the windowing or signal-detection code.*
  - Delivered by: `src/core/adapter.ts`'s `ActivityAdapter` interface; `FixtureReplayAdapter` and `GithubEventsLiveAdapter` (`src/adapters/*/index.ts`) both implement it and both produce the canonical `ApiActivityEvent` (`src/core/types.ts`, ADR 0001)

- ✅ 🛠️ **Force specific windowing conditions on demand for testing**
  - *As a platform engineer, I want a static, hand-authored event schedule with a deliberate burst, gap, and out-of-order event, so that I can test windowing edge cases a live source can't be made to produce on request.*
  - Delivered by: `FixtureReplayAdapter` (`src/adapters/fixture-replay/events.ts`) — baseline, burst, gap, late/out-of-order event, plus (per ADR 0006) a second synthetic tenant interleaved via a colliding actor id; per-event delay and jitter are configurable

- ✅ 🛠️ **Exercise the pipeline against genuine live traffic**
  - *As a platform engineer, I want to run the same pipeline against a real GitHub account's public activity, so that I can validate the system against real-world event shape and timing, not just fixtures.*
  - Delivered by: `GithubEventsLiveAdapter` (`GET /users/{username}/events`, deduped by event id); `XYLEM_ADAPTER=github-events-live` with `GITHUB_USERNAME`/`GITHUB_TOKEN`
  - Known issue: GitHub's public Events API is narrower than a true audit log — public activity only, no auth/session-level events — so impossible-travel and failed-auth-burst signals aren't demonstrable against it (see the two 🔲 signal stories below)

- ✅ 🛠️ **Reject malformed events at the boundary, not deep in signal logic**
  - *As a platform engineer, I want every event, from either adapter, validated against one Zod schema before it reaches any tracker, so that a malformed or missing field fails loudly at ingestion instead of corrupting sliding-window or first-seen state silently.*
  - Delivered by: `ApiActivityEventSchema` (`src/core/types.ts`), runtime-validated per ADR 0001; strict TypeScript throughout means no `!` non-null assertion papers over a field that didn't actually validate

- 🔲 🕵️ **See auth/session-level signals from a genuinely audit-log-shaped source**
  - *As a security analyst, I want a provider whose event stream actually carries authentication and session events, so that impossible-travel and failed-auth-burst detection can run against real traffic instead of only fixture data.*
  - TODO: Okta System Log API is named in README as the one candidate provider with this shape; not started — no adapter code exists for it

---

## 🛰️ Behavioral Signal Detection

- ✅ 🕵️ **Flag a burst of activity from one actor**
  - *As a security analyst, I want request velocity tracked per actor over a rolling time window, so that a sudden spike in activity from one identity is flagged rather than blending into the noise of overall traffic.*
  - Delivered by: `SlidingWindowVelocityCounter` (`src/core/window.ts`) — event-time-driven (a per-actor watermark, not wall-clock), `[VELOCITY BREACH]` at `VELOCITY_BREACH_THRESHOLD` (`src/core/thresholds.ts`)
  - Known issue: retains `2 × windowMs` of history to correctly answer a late event's own trailing window, but an event later than one full `windowMs` behind the watermark falls outside that bound and may be undercounted — a documented Phase 1 limitation; a real "allowed lateness" config is deferred (see the 🔲 story below)

- ✅ 🕵️ **Flag access from a source IP an actor has never used before**
  - *As a security analyst, I want the first time an actor is seen from a new IP flagged, so that credential-sharing or account-compromise patterns surface even without a velocity spike.*
  - Delivered by: `FirstSeenIpTracker` (`src/core/firstSeen.ts`) — per-actor `Set` of source IPs seen so far; by design, an actor's very first observed IP is also flagged (there's no "baseline" period for this signal)

- ✅ 🕵️ **Flag a geographically implausible sequence of actions**
  - *As a security analyst, I want two consecutive actions from the same actor flagged if the implied travel speed between them is physically impossible, so that a stolen session used from a second location is caught even if the IP alone looks unremarkable.*
  - Delivered by: `ImpossibleTravelDetector` (`src/core/impossibleTravel.ts`) — per-actor last-known `(lat, lon, timestamp)`, haversine great-circle distance ÷ time delta compared against `MAX_PLAUSIBLE_SPEED_KMH` (`src/core/thresholds.ts`); `[IMPOSSIBLE TRAVEL ...km/h]` on the console demo

- ✅ 🕵️ **Flag an actor exercising a permission scope for the first time**
  - *As a security analyst, I want a newly-exercised OAuth/API scope flagged for an actor who already has an established baseline, so that privilege escalation — not just a new actor's normal onboarding — is what actually gets surfaced.*
  - Delivered by: `ScopeEscalationTracker` (`src/core/scopeEscalation.ts`) — per-actor `Set` of scopes ever exercised; flags only once a baseline exists, so an actor's very first event establishes scopes rather than "escalating" into them

- ✅ 🛠️ **Get one combined severity score instead of four independent flags**
  - *As a platform engineer sending signals downstream, I want the four independent signals reduced to a single `[0, 1]` severity plus which signal(s) produced it, so that a downstream consumer with one threshold-based fast path doesn't need to reimplement four-way signal logic itself.*
  - Delivered by: `fuseSignals()` (`src/core/fusion.ts`, ADR 0005) — normalizes each signal independently, returns the max plus `firedCount` (how many fired at all, recovering co-occurrence information the max-of-four discards); `VELOCITY_BREACH_THRESHOLD`/`MAX_PLAUSIBLE_SPEED_KMH` are the single source of truth shared with the console demo's own flags

- 🔲 🕵️ **Correctly score a signal from a genuinely late-arriving event**
  - *As a security analyst, I want an event arriving more than one full window behind an actor's current watermark to still contribute accurately to that actor's velocity count, so that a legitimately delayed event (network retry, queue backpressure) doesn't produce an undercounted, falsely-quiet signal.*
  - TODO: named as a known Phase 1 limitation in README; a real "allowed lateness" configuration was scoped for Phase 2+ and has not been built

- 🔲 🕵️ **Detect a burst of failed authentication attempts**
  - *As a security analyst, I want repeated authentication failures from one actor flagged as their own signal, distinct from general velocity, so that a credential-stuffing attempt is named for what it is rather than showing up as an undifferentiated velocity breach.*
  - TODO: named in ADR 0001's full signal set but not scoped into Phase 2's build order; would need auth-event data neither current adapter reliably carries (see the Okta story above)

- 🔲 🕵️ **Flag a new device or user-agent, not just a new IP**
  - *As a security analyst, I want first-seen tracking to also cover device fingerprint and user-agent, so that an attacker reusing a known IP (e.g. via VPN) from a new device is still caught.*
  - TODO: `FirstSeenIpTracker` covers source IP only; device/UA would need a new `ApiActivityEvent` field neither adapter currently populates, so it wasn't added speculatively

---

## 🏢 Multi-Tenant Attribution

- ✅ 🛠️ **Attribute an event to a tenant without breaking single-tenant callers**
  - *As a platform engineer integrating a customer-attribution requirement, I want an optional `tenant` label on `ApiActivityEvent`, so that multi-tenant callers can attach it while every existing single-tenant fixture and adapter keeps working unchanged.*
  - Delivered by: `tenant?: string` on `ApiActivityEventSchema` (ADR 0006), prompted by a customer-attribution gap in the wider Rhizome Risk suite

- ✅ 🕵️ **See a concrete demonstration of a real tenant-collision risk, not just a hypothetical**
  - *As a security analyst, I want a fixture scenario that actually reproduces two tenants sharing a colliding actor id, so that I can see the false-positive risk in tracker output — not just read about it in a design doc.*
  - Delivered by: `FixtureReplayAdapter`'s `evt-11`..`evt-13` — a second synthetic tenant (`globex`) interleaved with a colliding actor id, producing a real velocity breach from combining two tenants' events under one actor id (ADR 0006)

- 🚫 🛠️ **Key trackers by `tenant:actor.id` instead of `actor.id` alone**
  - *As a platform engineer, I want tracker state keyed compositely by tenant and actor, so that the demonstrated collision (above) can't happen once a second real tenant exists.*
  - Deferred: ADR 0006 deliberately keeps tracker keying `actor.id`-only until a second *real* tenant enters the system — composite keying now would be speculative complexity against a fixture-only hypothetical, not a real collision

- 🔲 🔌 **Have tenant attribution survive the trip into Synapse-L4/Sentinel-L7**
  - *As a downstream pipeline (Sentinel-L7), I want the triggering event's `tenant` label to arrive on the Synapse-L4 ingest payload, so that Sentinel-L7 ADR-0031's tenant-label passthrough on `compliance_events` has a value to actually pass through.*
  - TODO: ADR 0008's 2026-07-18 addendum decides `buildIngestPayload()` should conditionally include `event.tenant` (mirroring how Synapse-L4's own `SentinelClient.post_axiom` handles `domain`), but `src/sinks/synapse-l4/index.ts` doesn't implement it yet — decision recorded ahead of code, per this project's standing decision-then-implementation split. Even once implemented here, Synapse-L4's own `RawTelemetry`/`AxiomDraft`/`Axiom` models don't accept the field yet, so the value would currently be silently dropped on arrival (same failure mode ADR 0008 originally found and fixed for `domain`)

---

## 🧷 Resilience & State Recovery

- ✅ 🛠️ **Survive a process restart without losing tracker state**
  - *As a platform engineer, I want all four trackers' state persisted to disk after every event and restored on startup, so that restarting the process (a deploy, a crash) doesn't silently reset velocity windows, first-seen sets, or scope baselines back to empty.*
  - Delivered by: `CheckpointStore` (`src/core/checkpoint.ts`, Phase 3) — each tracker exposes `getState()`/`loadState()`; one versioned JSON file (`.xylem-checkpoint.json`, path overridable via `XYLEM_CHECKPOINT_FILE`), saved after every event, printing `(resumed from checkpoint)` on the next run when found

- ✅ 🛠️ **Start clean without manually clearing four separate trackers**
  - *As a platform engineer, I want a single checkpoint file I can delete to reset all tracker state at once, so that starting a fresh demo run doesn't require reasoning about four independent pieces of state.*
  - Delivered by: `CheckpointStore` bundling all four trackers into one file; deleting `.xylem-checkpoint.json` is sufficient to start fresh

- 🔲 🛠️ **Survive a restart across ephemeral compute, not just one machine's disk**
  - *As a platform engineer deploying to GKE, I want checkpoint state to live in a durable external store rather than local disk, so that a pod being rescheduled onto different underlying compute doesn't lose in-flight tracker state the way a local JSON file would.*
  - TODO: Roadmap Phase 8, per ADR 0003's Decision ("Firestore for checkpoint state... small, cheap, and the right shape for a window checkpoint"). ADR 0003 itself is still `Proposed`, not `Accepted`; nothing is built yet

---

## 📤 Downstream Delivery (Fusion + Synapse-L4)

- ✅ 🔌 **Receive every event's fused severity, not only the ones that breached a threshold**
  - *As a downstream pipeline, I want every event's fused score sent to me regardless of severity, so that I have baseline "nominal" visibility rather than only ever hearing about the events that already crossed a line.*
  - Delivered by: `SynapseL4Sink.send()` (`src/sinks/synapse-l4/index.ts`, ADR 0008) — no severity gate; mirrors Synapse-L4's own EventHorizon client, which forwards every message unconditionally

- ✅ 🔌 **Receive a payload shape that maps directly onto my own fast path, no translation needed**
  - *As a downstream pipeline, I want `source_id`/`status`/`metric_value`/`anomaly_score`/`domain` on the wire in the exact shape my deterministic fast path expects, so that a well-formed Xylem-L6 event never needs a translation layer or falls through to a slower path unnecessarily.*
  - Delivered by: `buildIngestPayload()` (ADR 0008) — `source_id` is the triggering event's own `id`; `status` derived from `score` via Synapse-L4's own Judge thresholds (`0.8`/`0.5`, mirrored as constants since no cross-language import exists between the two repos); `metric_value` is `firedCount`; `domain` is the constant `"saas"`
  - Known issue: the mirrored Judge thresholds (`0.8`/`0.5`) are plain TypeScript literals with no mechanism to detect drift if `synapse-l4/src/evaluation/rules.py`'s values ever change — accepted per ADR 0008's Consequences, revisit if a shared contract-testing mechanism becomes worth building

- ✅ 🛠️ **Run the default demo with zero external dependencies**
  - *As a platform engineer, I want sending to Synapse-L4 to be strictly opt-in, so that `npm run dev` stays a self-contained demo that never fails or floods the console with send errors just because no Synapse-L4 instance happens to be running.*
  - Delivered by: `XYLEM_SYNAPSE_L4_ENABLED` (default off), `SYNAPSE_L4_URL` override (default `http://localhost:8000`); deliberately not default-on (ADR 0007/0008 left the always-on question open, and wiring it in unconditionally would have broken this property)

- ✅ 🛠️ **Keep a bad downstream response from crashing the whole event loop**
  - *As a platform engineer, I want a network failure or non-2xx response from Synapse-L4 logged and the loop to continue, so that one bad event or a temporary Synapse-L4 outage doesn't take down otherwise-healthy event processing.*
  - Delivered by: `SynapseIngestError` caught in `src/index.ts`'s main loop, logged as `[SYNAPSE-L4 SEND FAILED]`; no retry, no circuit breaker — matches Synapse-L4's own stated precedent that "one bad event must never crash the consumer loop"

- 🔲 🔌 **Have my domain-scoped retrieval always have a domain to filter on**
  - *As a downstream pipeline, I want every event I receive from Xylem-L6 to carry a valid `domain`, so that Sentinel-L7's domain-scoped policy retrieval always has something to filter against instead of silently falling back to unscoped retrieval.*
  - TODO: `domain: "saas"` is sent as a constant on every payload today (implemented), but this depends on a cross-repo prerequisite ADR 0008 named but didn't itself resolve: `synapse-l4`'s `ComplianceDomain` Literal and `_VALID_DOMAINS` frozenset needed `"saas"` added on that repo's side — resolved there as of 2026-07-17, tracked here as a dependency rather than owned here

---

## 🏗️ Platform Operations & Deployment

- ✅ 🛠️ **Catch a domain-isolation violation before it ships**
  - *As a platform engineer, I want an automated check that nothing under `src/core/` imports from `src/adapters/`, so that adapter-specific HTTP/SDK code can never leak into the signal-computation core by accident.*
  - Delivered by: `tests/arch.test.ts` — run after any change under `src/core/`, per this project's Domain Logic Isolation rule

- ✅ 🛠️ **Trust that a schema change is caught by tests, not discovered live**
  - *As a platform engineer, I want the schema, every tracker (including the late/out-of-order case), the checkpoint round-trip, the fusion function (dataset-driven over signal combinations, including boundary/tie/`firedCount` cases), the ADR 0006 tenant collision scenario, both adapters, and the Synapse-L4 sink's payload mapping and error handling all covered by tests that never hit a real network, so that a regression is caught locally, not after a live run.*
  - Delivered by: Vitest suite under `tests/`, mirroring `src/` by module; `github-events-live` and the Synapse-L4 sink are both tested via an injected/mocked fetch, never a real call

- ✅ 🛠️ **Run TypeScript directly without a separate build step during development**
  - *As a platform engineer, I want to iterate on the pipeline without a compile step between edits and running it, so that the feedback loop for a signal-logic change stays fast.*
  - Delivered by: `tsx`; strict mode plus explicit `.js` extensions on local imports (NodeNext ESM resolution) catch nullable-path and module-resolution mistakes at edit time

- 🔲 🛠️ **Replace adapter-level polling with a real ingestion transport**
  - *As a platform engineer, I want events to arrive via a managed pub/sub transport instead of each adapter polling its source directly, so that ingestion scales and decouples from any one adapter's polling cadence.*
  - TODO: ADR 0003 (still `Proposed`) names GCP Pub/Sub as the target; not built

- 🔲 🛠️ **Deploy Xylem-L6 alongside the rest of the suite, not run it locally only**
  - *As a platform engineer, I want Xylem-L6 running in the same shared-cluster namespace pattern already used by EventHorizon and Rhizome Lens, so that it's a real running service in the suite, not a laptop-only demo.*
  - TODO: ADR 0003 names GKE as the deployment target over Railway (credits-vs-Always-Free tradeoff); not built

- 🚫 🛠️ **Add an LLM-based step anywhere in the pipeline**
  - *As a platform engineer evaluating scope creep, I want confirmation that Xylem-L6 stays a deterministic signal computation layer with no AI/LLM step of its own, so that model cost, latency, and non-determinism never enter this repo's own pipeline.*
  - Deferred: explicit non-goal, not an oversight — see ADR 0003 ("Vertex AI is not used — Xylem-L6 has no LLM step; that stays Sentinel-L7's domain entirely")
