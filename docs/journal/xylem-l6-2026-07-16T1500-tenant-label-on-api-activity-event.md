---
id: xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event
repo: xylem-l6
title: "Xylem-L6 Tenant Label Decision (ADR 0006 — Optional `tenant` on `ApiActivityEvent`)"
date: 2026-07-16
phase: 4
tags: [adr, decision-record, tenant, multi-tenancy, schema, optional-field, fixture-replay, sentinel-l7, ledger-l5, cross-repo]
files:
  - docs/adr/0006-tenant-label-on-api-activity-event.md
  - README.md
---

### Pattern: Originating a Label Upstream, Before There's Something Live to Retrofit
The decision was grounded in where Xylem-L6 actually sits in its own
lifecycle, not just in the abstract merits of a `tenant` field: `index.ts`
still only emits a `console.log` interpolated string (no structured payload
exists anywhere yet), and no Sentinel-L7 integration code has been written.
That's what makes this the cheapest point in the whole system's lifecycle to
introduce a tenant identifier — there's no live consumer, no persisted
payload shape, and no checkpoint format to migrate. The gap this closes was
discovered one repo over, in Ledger-L5's ADR-0005, which documents
`usage_events` having no `customer_id` to join Phase 4's `rate_cards` against
— traced back to Sentinel-L7's own ADR-0020 deliberately keeping
multi-tenancy out of Sentinel-L7 entirely.

### Anti-Pattern Avoided: Retrofitting Identity Onto a Live System
The alternative — adding tenant identity later, once Sentinel-L7 is actually
receiving events — would mean introducing the concept after a real payload
shape, and possibly real tracker/checkpoint state, already exists and is
depended upon. Originating the label here, on the input event type, while
Xylem-L6 is still pre-wiring, avoids that retrofit entirely. It's also scoped
narrowly on purpose: a passthrough field is deliberately kept smaller than
the isolation/auth infrastructure Sentinel-L7's ADR-0020 already declined to
build — this ADR doesn't quietly reopen that decision from a different repo.

### Challenge: Resolving a Garbled Cross-Repo ADR Reference
The Context section's draft arrived with an ambiguous citation — a
reference that named both "Sentinel-L7 ADR-0004" and "Xylem-L6 ADR 0004" in
the same breath for the fact that Xylem-L6 is Sentinel-L7's committed Phase 4
sink. Only one of those is correct (Xylem-L6's own ADR 0004). Small, but
worth catching before commit: a cross-repo citation error in an ADR is the
kind of thing that gets copied forward into other repos' docs and is
tedious to trace back once it has propagated.

### Decision: Optional Field, Not Required
`tenant: z.string().optional()` was chosen over a required field because
`github-events-live` and existing fixture data have no natural tenant
concept — a GitHub username isn't a customer — and forcing a required field
would mean inventing a value with no real meaning behind it, purely to
satisfy the schema. Optionality also avoids touching Phase 1–3 tests, which
don't set it and have no reason to.

### Decision: Leave Tracker Keying on `actor.id` Alone
Composite-keying all four trackers by `tenant:actor.id` was considered and
rejected for now — not because it's wrong, but because there's exactly one
real tenant in this system today, so it would be speculative complexity
against a hypothetical collision rather than a real one. The revisit trigger
is explicit and mechanical: a second real tenant entering the system, not a
subjective judgment call next time.

### Decision: Demonstrate the Field via `fixture-replay`, Not `github-events-live`
Of the two working adapters, only `fixture-replay` can populate `tenant`
meaningfully — `github-events-live` has no tenant boundary in its source
data, and a future Okta-shaped adapter would derive tenant structurally
(one org's System Log is one tenant) rather than per-event. That leaves
hand-authored fixtures as the only place a multi-tenant scenario can be
constructed on purpose. The ADR commits to revising the fixture schedule to
interleave at least two synthetic tenants (e.g. `acme-corp`, `globex`) so the
single-tenant tracker-keying limitation becomes something the demo can
actually show — an `actor.id` collision across two tenants — rather than
staying a documented hypothetical. That revision is not yet done as of this
ADR.
