---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, adr, cross-repo]
---
ADR 0006 adds a tenant identifier to `ApiActivityEvent` while Xylem-L6 is still pre-wiring, because at this point in the lifecycle there is `{{c1::no live consumer, no persisted payload shape, and no checkpoint format to migrate}}` — the cheapest possible moment to introduce the concept.

Extra: xylem-l6 · Pattern: Originating a Label Upstream, Before There's Something Live to Retrofit
See: docs/journal/xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, adr, ledger-l5]
---
The gap ADR 0006 closes was discovered in a different repo: Ledger-L5's ADR-0005 documents `usage_events` having no `{{c1::customer_id}}` column to join Phase 4's `rate_cards.customer_id` against.

Extra: xylem-l6 · Pattern: Originating a Label Upstream, Before There's Something Live to Retrofit
See: docs/journal/xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, anti-pattern]
---
Adding tenant identity only once Sentinel-L7 is receiving real events would mean introducing the concept after a real payload shape and checkpoint state already exist and are depended upon — this is the anti-pattern of `{{c1::retrofitting identity onto a live system}}`, avoided by originating the label upstream instead.

Extra: xylem-l6 · Anti-Pattern Avoided: Retrofitting Identity Onto a Live System
See: docs/journal/xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, scope]
---
ADR 0006's `tenant` passthrough field is deliberately kept smaller than the isolation/auth infrastructure Sentinel-L7's `{{c1::ADR-0020}}` already declined to build — the new ADR doesn't quietly reopen that decision from a different repo.

Extra: xylem-l6 · Anti-Pattern Avoided: Retrofitting Identity Onto a Live System
See: docs/journal/xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, testing, velocity-counter]
---
`tests/adapters/fixture-replay.test.ts` proves the cross-tenant false-positive isn't just asserted in prose: it pipes the three colliding `chen` events through the real `SlidingWindowVelocityCounter` and asserts the resulting velocities are `{{c1::[1, 2, 3]}}`, breaching the threshold on the third event.

Extra: xylem-l6 · Pattern: Proving a Documented Limitation Through a Real Tracker Run, Not Just Prose
See: docs/journal/xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, anti-pattern, scope-discipline]
---
Q: Once the `chen` collision scenario was working and visibly producing a false `[VELOCITY BREACH]`, why wasn't the tracker keying fixed right there?

A: ADR 0006's Decision section is explicit that tracker keying stays `actor.id`-only until a second *real* tenant exists — the revisit trigger is that event, not "the demonstration made the bug feel urgent." Demonstrating a limitation and fixing it are different acts; fixing it here would have gone beyond what the ADR actually decided.

Extra: xylem-l6 · Anti-Pattern Avoided: Fixing a Bug the ADR Explicitly Didn't Ask to Fix
See: docs/journal/xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, challenge]
---
Q: What was the actual friction in producing ADR 0006, given it's a decision record with no code change?

A: The draft's Context section arrived with an ambiguous cross-repo citation, naming both "Sentinel-L7 ADR-0004" and "Xylem-L6 ADR 0004" for the same fact (that Xylem-L6 is Sentinel-L7's committed Phase 4 sink). Only the latter is correct. It was resolved before commit — small, but the kind of citation error that propagates into other repos' docs if left uncaught.

Extra: xylem-l6 · Challenge: Resolving a Garbled Cross-Repo ADR Reference
See: docs/journal/xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, decision, optional-field]
---
`tenant` was made `{{c1::optional}}`, not required, because `github-events-live` and existing fixtures have no natural tenant concept — a GitHub username isn't a customer — and forcing a value would mean inventing one with no real meaning.

Extra: xylem-l6 · Decision: Optional Field, Not Required
See: docs/journal/xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, decision, revisit-trigger]
---
ADR 0006 leaves all four trackers keyed on `actor.id` alone rather than composite-keying by `tenant:actor.id`, because there is exactly one real tenant today. The revisit trigger is explicit: `{{c1::a second real tenant entering the system}}`, not a subjective judgment call.

Extra: xylem-l6 · Decision: Leave Tracker Keying on actor.id Alone
See: docs/journal/xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, decision, fixture-replay]
---
Q: Why is `fixture-replay`, not `github-events-live`, the adapter ADR 0006 commits to revising for multi-tenant demonstration?

A: `github-events-live` has no tenant boundary in its source data — a GitHub username isn't a customer, so any tenant value there would be synthetic at the adapter-config level. A future Okta-shaped adapter would derive tenant structurally (one org's System Log is one tenant), not per-event. Hand-authored fixtures are the only place a multi-tenant scenario — e.g. two tenants sharing an `actor.id` — can be constructed on purpose, which is also exactly why `fixture-replay` exists per ADR-0001.

Extra: xylem-l6 · Decision: Demonstrate the Field via fixture-replay, Not github-events-live
See: docs/journal/xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, decision, testing]
---
Q: Why were the new `chen` collision events (`evt-11`..`evt-13`) appended after `evt-1`..`evt-10` instead of spliced into the existing schedule by array position?

A: `evt-1`..`evt-10` already carry meaning tied to their exact positions and delays (the burst, the gap, the late arrival), and two existing tests read `defaultSchedule` directly, including one that checks the whole schedule stays schema-valid and includes an out-of-order timestamp. Appending a self-contained block — where the three `chen` events are interleaved with *each other*, just not spliced into the earlier block — satisfies ADR 0006's "interleaved, not segregated into separate runs" requirement (one schedule, one `stream()` call) without risking the existing burst/gap/late-arrival scenarios or their tests.

Extra: xylem-l6 · Decision: Append the Collision Scenario, Rather Than Splicing It Into evt-1..10
See: docs/journal/xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, decision, observability]
---
`tenant=...` was added to `index.ts`'s existing demo console line rather than left unprinted, because that line is `{{c1::the only place any event field is ever observed}}` — without it, the field would be schema-valid but never actually seen by anything.

Extra: xylem-l6 · Decision: Print tenant in the Demo's Existing Console Line
See: docs/journal/xylem-l6-2026-07-16T1500-tenant-label-on-api-activity-event.md
