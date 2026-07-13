# ADR 0001 — Xylem-L6: SaaS API Activity as the Ingestion Target, Standalone Stream Processor

**Status:** Accepted
**Date:** 2026-07-13

---

## Context

The Rhizome Risk suite has no genuine stream *processing* component. EventHorizon is a four-stage message pipeline (Ingestion → Processing → Storage → Observation) over RabbitMQ and MongoDB — it moves and persists events, and it does have backpressure, but of a specific kind: RabbitMQ's queue depth absorbing the gap between producer and consumer rate, external to any single stage's own code. Nothing in the suite holds state across events, computes over a time window, handles out-of-order arrival, or applies in-process backpressure — a stage explicitly reasoning about its own buffer filling up and choosing to slow, shed, or push back, rather than relying on the broker to absorb the difference. That in-process form is what this project exists to build, deliberately, as a gap-closing exercise rather than a felt operational need — a departure from "wait until it hurts," named explicitly here because nothing in the suite currently hurts for lack of this.

Two ingestion targets were considered: financial transactions (extending Sentinel-L7's existing compliance domain) and SaaS API activity logs (GitHub, Okta, Auth0, Slack). SaaS API activity was chosen. It reframes the artifact as a *security* signal generator (credential stuffing, impossible travel, scope escalation) rather than a compliance one — a broader, more immediately legible audience for a portfolio piece than fraud/AML scoring. It's also the correct approximation of Xylem-L6's actual architectural role: like EventHorizon, it's built naively as a consumer of real, live account activity first, with no assumption at Phase 1 about what (if anything) consumes its output — that opportunity, if it arises, is handled the same way EventHorizon's Sentinel-L7 hookup was: recognized when it presents itself, not designed in advance.

GitHub's Audit Log REST API is enterprise/organization-admin only and isn't reachable from a personal account, so it isn't used here. Okta's System Log API remains audit-log-shaped as described below and is unaffected.

## Decision

Build a standalone stream processor, **Xylem-L6**, that:

1. Defines a canonical `ApiActivityEvent` contract (actor, action, resource, source IP, geo, timestamp, outcome, scopes/permissions exercised) — the same move `Axiom` makes in Synapse-L4 — validated at runtime with **Zod**. Two adapters implement this contract from Phase 1, behind one shared interface:
   - `fixture-replay` — static sample event data (hand-authored or drawn from public Okta System Log documentation), streamed in with controllable timing/jitter. This is the adapter used to force specific conditions on demand — a late/out-of-order event, a burst, a gap — that a live source can't be made to produce reliably on request.
   - `github-events-live` — GitHub's public **Events API** (`GET /users/{username}/events`), polled against the account's own real activity (pushes, PR opens, issue comments, stars). Real, live, requires only a personal access token, no special scope. Narrower in shape than a true audit log — public activity only, no auth/session-level events — but genuine live traffic from a real account, which fixture data can't claim to be.
   - Okta's System Log API remains a candidate third adapter, deferred; it's the one provider here whose schema is genuinely audit-log-shaped (auth events, session data), which neither of the two Phase 1 adapters cover.
2. Computes a small set of stateful security signals per identity/key: request velocity over a sliding window, failed-auth bursts, first-seen IP/device/user-agent, impossible travel (geo-distance vs. time-delta between two auth events), and scope escalation. Not all signals apply equally to both adapters — impossible travel and failed-auth bursts need auth-event data that `github-events-live`'s public activity feed doesn't carry; velocity and first-seen signals apply to either.
3. Ships with no assumed consumer at Phase 1–3. It does not call Sentinel-L7, EventHorizon, or Synapse-L4, and nothing in the suite calls it. See ADR 0002 for the forward-looking direction on Sentinel-L7 integration specifically, and Consequences below for the general posture.
4. Is built in **TypeScript**, with **Zod** as the runtime schema-validation layer for `ApiActivityEvent` and the provider-adapter inputs — the TS-side equivalent of Pydantic/Instructor's role in Synapse-L4 and Arbiter-L8. Implementation is delegated to Claude Code; this ADR fixes the architectural decisions Claude Code implements against, not the implementation itself.

Build order (phased, each independently demoable):

- **Phase 1** — canonical event type, both adapters (`fixture-replay` and `github-events-live`) behind the shared interface, in-memory sliding-window velocity counter. No persistence, no external hookup.
- **Phase 2** — add the signals that require running state rather than a counter: first-seen sets, impossible travel. This is where per-identity state actually earns its keep over Phase 1's window-only logic.
- **Phase 3** — checkpointing, so process restart doesn't silently drop in-flight window/state.
- **Phase 4** — sink decision (standalone dashboard vs. EventHorizon vs. Sentinel-L7), made deliberately and by ADR when it's reached, not assumed now.

## Rationale

Choosing SaaS API activity over financial transactions keeps the algorithmic core identical — sliding windows, watermarks for late events, per-key state, backpressure, dedup are all still exercised — while decoupling this project's credibility from Sentinel-L7's compliance framing. A reviewer with a security background can evaluate this project without first buying into the fintech compliance narrative; a reviewer with a fintech background can still recognize velocity/anomaly detection as the same primitive.

Building Xylem-L6 as a consumer with no built-in producer, rather than a self-contained generator-and-processor pair, follows the same instinct EventHorizon was built on: get the processing logic right against real or realistic input first, and let integration opportunities surface on their own rather than architecting for a hookup that doesn't exist yet. A closed loop where Xylem-L6 both generates and consumes its own traffic would prove the generator and processor agree with each other, not that the processing logic is correct.

Running two adapters from Phase 1, rather than one now and a second deferred, is a direct response to a real limitation: `fixture-replay` is the only adapter that can be made to reliably produce the specific conditions windowing logic needs to be tested against on demand (a late arrival past the watermark, a burst at the window boundary), while `github-events-live` is the only one that gives Xylem-L6's demo a claim EventHorizon's fixture-driven build never had — that it's processing genuine live traffic, not replayed data, from Phase 1 onward.

Standalone-first, rather than routing into Sentinel-L7 directly, avoids a scope decision this ADR isn't the right place to make — see ADR 0002 for that direction specifically.

TypeScript was chosen over Python primarily for interview relevance, not language preference — a backend TypeScript interview is upcoming, and this project is direct rehearsal for it rather than adjacent practice. It also closes a real gap: streaming is one of the sharper front-end/back-end TypeScript differences, and nothing in the existing suite (all Python except EventHorizon's plumbing) has exercised backend-TS streaming. Zod as the validation layer keeps the "runtime schema validation is a discipline, not a language feature" pattern consistent across the suite — Pydantic/Instructor in Synapse-L4 and Arbiter-L8, Zod here — which is a stronger thing to point to in an interview than either language choice alone.

## Alternatives Considered

| Option | Pro | Con |
|---|---|---|
| Extend Sentinel-L7 directly with financial transaction velocity checks | No new repo; reuses existing compliance framing | Doesn't close the streaming-algorithm gap any better than SaaS activity would, and narrows the audience to compliance-context reviewers only |
| SaaS API activity, routed into Sentinel-L7 as a signal source from the start | One fewer future integration decision | Premature — see ADR 0002; the scored-output contract and policy corpus this would require don't exist yet |
| Single adapter at Phase 1 (`github-events-live` only), `fixture-replay` deferred | Less to build before Phase 1 is "done" | No reliable way to force specific windowing edge cases (late events, boundary bursts) on demand against live traffic alone |
| GitHub Audit Log REST API as the adapter source | Genuine audit-log-shaped schema (auth/session events) | Enterprise/org-admin only — not reachable from a personal account at all; not actually available here |
| Build against synthetic/invented event data instead of real provider schemas | Faster to start, no adapter-format research | Less credible as a demo artifact; skips real schema-mapping work that's part of the point |
| Use a stream-processing framework (Kafka Streams, Flink) instead of hand-rolled windowing | Production-grade semantics for free | Defeats the purpose — the gap being closed is understanding windowing/backpressure/state well enough to implement it, not operating someone else's engine |
| Python + Pydantic, matching Synapse-L4/Arbiter-L8/Ledger-L5/Rhizome Lens | Stack consistency with the rest of the newer suite; more comfortable language | Doesn't serve an upcoming TypeScript backend interview, and leaves the suite's only backend-TS streaming gap exactly where it was |

## Consequences

- This project has no consumer dependency at Phase 1–3 and one live producer (`github-events-live`) that it depends on for its real-traffic demo claim; if GitHub's Events API access changes, that adapter's demo value degrades but `fixture-replay` keeps the project functional and testable regardless.
- A decision to feed Sentinel-L7 from this project's output follows the direction in ADR 0002, not this ADR — nothing here commits to it.
- `github-events-live`'s signal coverage is narrower than the full signal set in ADR 0001: no auth/session-level events means impossible-travel and failed-auth-burst signals can't be demonstrated against it. Those signals remain demonstrable via `fixture-replay`, and would become live-demonstrable if an Okta adapter is added later.
- Implementation is delegated to Claude Code against this ADR; conceptual/architectural decisions stay here, not in the implementation environment.