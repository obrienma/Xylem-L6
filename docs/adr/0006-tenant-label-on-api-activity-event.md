# ADR 0006 — Tenant Label on `ApiActivityEvent`

**Status:** Proposed
**Date:** 2026-07-16

---

## Context

Ledger-L5's ADR-0005 (Sentinel-L7 Usage-Pull Contract) documents a real, already-acknowledged gap: `usage_events` has no `customer_id` column, and Phase 4's `rate_cards.customer_id` has nothing on `usage_events` to join against. That gap exists because Sentinel-L7 itself has no customer identity to attribute usage to — a direct consequence of Sentinel-L7's own ADR-0020, which deliberately deferred all multi-tenancy and RBAC work out of Sentinel-L7 to a separate TypeScript project, for portfolio-signal reasons unrelated to billing.

Xylem-L6 is now Sentinel-L7's committed Phase 4 sink (per Xylem-L6 ADR 0004) and is still pre-wiring — no integration code exists yet. This is the first point in the data's lifecycle where a tenant identifier could be introduced without retrofitting a system that's already live.

`ApiActivityEventSchema` (`src/core/types.ts`) currently has an `actor` object (`id`, `type: user | service_account | unknown`) but no tenant or customer field. Two things were confirmed absent when checking this:

- **No structured event payload is emitted anywhere yet.** `index.ts` only produces a `console.log` interpolated string (confirmed in ADR-0005's Context) — there is nothing downstream today for a tenant field to reach.
- **All four stateful trackers key purely on `actor.id`** (`SlidingWindowVelocityCounter`, `FirstSeenIpTracker`, `ImpossibleTravelDetector`, `ScopeEscalationTracker`, all called with `activityEvent.actor.id` alone in `index.ts`). Adding a tenant field to the schema does not, by itself, change tracker correctness — that's a separate question addressed below.

## Decision

Add an optional `tenant` field to `ApiActivityEventSchema`:

```typescript
tenant: z.string().optional(),
```

Optional, not required: existing fixture data and the `github-events-live` adapter have no natural tenant concept (a GitHub username isn't a tenant), and forcing a required field here would mean inventing a value with no real meaning behind it.

**Tracker keying is not changed by this ADR.** All four trackers continue to key on `actor.id` alone. This system has exactly one real tenant in practice; there is no correctness bug to fix today, only a hypothetical one. If a second tenant becomes real, composite-keying (`tenant:actor.id`) is the fix, and it's a small, mechanical change — but it isn't made speculatively here, consistent with "wait until it hurts."

The field is carried on the input event type only. Whether and how it propagates into a structured output payload is scoped to the not-yet-authorized Sentinel-L7 transmission wiring (per ADR-0004's Consequences) and is not decided here.

## Decision — demonstrating it via `fixture-replay`

Of Xylem-L6's two adapters, only `fixture-replay` can populate `tenant` meaningfully today. `github-events-live` has no natural tenant boundary in its source data — a GitHub username isn't a customer — so any value assigned there would be synthetic at the adapter-config level, not derived from anything real. A live Okta-shaped adapter (deferred, not built) would identify tenant from *which org's credentials are being polled*, not from a per-event field, since Okta doesn't multiplex multiple orgs' logs into a single stream — one org's System Log is one tenant, structurally.

That leaves hand-authored fixture data as the only place a multi-tenant scenario can be constructed on purpose rather than discovered incidentally — which is also exactly why `fixture-replay` exists per ADR-0001 (forcing specific conditions on demand that a live feed can't guarantee).

**Revise the fixture schedule to include events from at least two distinct synthetic tenants** (e.g. `acme-corp`, `globex`), interleaved rather than segregated into separate runs, so that:

- The single-tenant tracker-keying limitation noted above becomes something the fixture schedule can actually exercise and show (e.g. a velocity-window false-positive risk if two tenants happen to share an `actor.id`), rather than only being a documented hypothetical.
- The `tenant` field has at least one real exercised path from input event through to whatever downstream consumer eventually reads it, rather than sitting unused in the schema.

This does not change the tracker-keying decision above — trackers still key on `actor.id` alone. The multi-tenant fixture scenario is meant to make that limitation *visible* (e.g., in a demo, a collision between two tenants' actors sharing an ID), not to fix it preemptively.

## Rationale

Originating the label at Xylem-L6 rather than retrofitting it onto Sentinel-L7 keeps Sentinel-L7's ADR-0020 posture intact: 0020 rejected building isolation/auth infrastructure in Sentinel-L7, not accepting a label that arrives from an upstream source. A passthrough field is a materially smaller thing than what 0020 declined.

Making the field optional rather than required avoids inventing tenant identity for adapters that don't have one, and avoids blocking Phase 1–3 tests (which don't set it) on a schema change unrelated to their purpose.

## Alternatives Considered

| Option | Pro | Con |
|---|---|---|
| Required `tenant` field | Forces every event to declare identity | No real value exists for `github-events-live`; would require inventing one |
| Composite-key all trackers by `tenant:actor.id` now | Correct under a hypothetical second tenant | No second tenant exists; speculative complexity against "wait until it hurts" |
| Add tenant only at the Sentinel-L7 sink boundary, not on the event type | Keeps Xylem-L6's core event type untouched | Loses the label before it ever reaches the trackers or checkpoint state, foreclosing any future per-tenant tracker logic without a second schema change |

## Consequences

- `ApiActivityEventSchema` gains one optional field; no adapter is required to populate it today.
- The `fixture-replay` schedule needs revision to author at least two synthetic tenants — not yet done as of this ADR.
- Tracker state (`checkpoint.ts`) remains single-tenant-shaped. This is a stated, deliberate limitation, not an oversight — revisit trigger: a second real tenant enters the system. The multi-tenant fixture scenario makes this limitation demonstrable, not resolved.
- The structured output payload that will eventually carry this field to Sentinel-L7 is still undesigned — this ADR does not authorize or design that wiring.
- Fixture data and the `github-events-live` adapter are unaffected in schema terms; neither needs to change to remain valid, though `fixture-replay`'s event schedule does need the tenant-authoring revision above.
