---
id: xylem-l6-2026-07-14T0016-phase-2-stateful-signals
repo: xylem-l6
title: "Xylem-L6 Phase 2 (first-seen IP, impossible travel, scope escalation)"
date: 2026-07-14
phase: 2
tags: [idempotent-receiver, seen-set, cold-start, running-state, sliding-window, adr-addendum]
files:
  - src/core/firstSeen.ts
  - src/core/impossibleTravel.ts
  - src/core/scopeEscalation.ts
  - src/adapters/fixture-replay/events.ts
  - src/index.ts
  - docs/adr/0001-ingestion-target-stream-processor.md
  - README.md
---

### Pattern: Idempotent Receiver (repurposed for novelty detection)
`GithubEventsLiveAdapter` already used a per-key seen-set (`seenEventIds`) as an
**idempotent receiver** — the classic use is deduplicating a message already
processed, so a retry or at-least-once redelivery doesn't get double-counted.
Phase 2's `FirstSeenIpTracker` and `ScopeEscalationTracker` reuse the exact
same shape — a `Map<actorId, Set<value>>`, checked-then-inserted on each call
— but invert the payoff: the *interesting* case isn't "already seen, skip it,"
it's "already seen, so this one isn't" flips to "never seen, flag it." Same
data structure, same check-then-insert sequencing, opposite consumer of the
boolean it returns.

### Pattern: Running State vs. Windowed State
`SlidingWindowVelocityCounter` (Phase 1) is bounded, evicting state: it only
ever answers "how many in the last `windowMs`," and old timestamps are
deliberately pruned. Phase 2's three trackers are a different shape of
state entirely — unbounded, per-actor memory that never evicts (`FirstSeenIpTracker`'s
seen-IP set, `ScopeEscalationTracker`'s seen-scope set) or holds exactly one
most-recent point (`ImpossibleTravelDetector`'s last-known geo/timestamp).
Naming this distinction explicitly (rather than treating "stateful" as one
undifferentiated bucket) is what ADR 0001's Phase 2 line means by "signals
that require running state rather than a counter" — the counter's eviction
is the wrong tool once the question becomes "has this ever happened before,"
not "how many recently."

### Anti-Pattern Avoided: Cold-Start False Positive
`ScopeEscalationTracker.record` explicitly tracks `hadBaseline` (was the
actor's seen-scope set non-empty *before* this call) and only reports
`isEscalation: true` when `hadBaseline && newScopes.length > 0`. The tempting
shortcut — flag any scope not yet in the set — would mark literally every
actor's first-ever event as a scope escalation, since an empty set makes
every scope "new." That's a permanent false-positive-on-baseline bug, not an
edge case: every legitimate first login would alarm. `FirstSeenIpTracker`
deliberately does *not* apply the same guard, because "first IP ever" is
itself the useful signal there (matches how real first-seen-device alerts
work) — the guard is specific to escalation, not to seen-sets generally.

### Challenge: Unintentional Cross-Signal Interaction in Fixture Data
While hand-authoring `evt-9` to establish a scope baseline for the
scope-escalation demo, I didn't override its `geo` field, so it silently
inherited the shared `event()` default (NYC). Combined with `evt-8`'s London
coordinates ten seconds earlier, that produced a spurious `[IMPOSSIBLE
TRAVEL 2005280km/h]` flag in the demo output — correct per the code, but
unrelated to what `evt-9` was meant to exercise, and misleading in the
transcript. No unit test caught it, because each tracker's tests are
isolated per-tracker; only running the full `npm run dev` demo end-to-end
surfaced the interaction. Fixed by giving `evt-9`/`evt-10` explicit `geo`
matching `evt-8`'s location, since they're meant to hold geography constant
while varying scopes. Take-away: shared fixture defaults compose across
signals in ways single-tracker tests can't see — the demo run is doing real
integration-test work here, not just being a nice-to-have.

### Decision: Resolve the ADR/README Scope Discrepancy via Addendum, Not Silent Interpretation
ADR 0001's Decision section and the README roadmap bullet said Phase 2 was
"first-seen sets, impossible travel"; the README's own pipeline diagram
additionally tagged scope escalation as Phase 2. Rather than picking one
silently (or editing the ADR's original Phase 2 text as if it always said
that), the user wrote an addendum to ADR 0001 recording the discrepancy and
its resolution — scope escalation is in scope, because mechanically it's the
same seen-set shape as first-seen tracking, not new windowing logic. This
kept the ADR's original text as a historical record of what Phase 1 was
actually built against, while making the resolved scope binding going
forward. The README's pipeline diagram was corrected to match the addendum
during this phase.

### Decision: Bundle All Three Signals into One Commit/Journal Entry
Given a choice between three separate commits+journal-entries (one per
signal, matching the step-by-step build-and-pause cadence) or one bundled
commit+entry for the whole phase, the bundled option was chosen — matching
Phase 1's precedent, where both adapters and the velocity counter shipped as
a single commit and journal entry despite being separable units of work.
Trade-off: less granular git history within the phase, but consistent
phase-sized commit/journal cadence going forward.

### Decision: First-Seen Tracking Is IP-Only, Not IP/Device/UA
ADR 0001's full signal description names "first-seen IP/device/user-agent,"
but `ApiActivityEvent` has no device or user-agent field, and neither
adapter would populate one if it existed — GitHub's public Events API
doesn't expose it, and adding it to the fixture data alone would mean
testing against a field no real adapter produces. `FirstSeenIpTracker` was
scoped to `sourceIp` only, the one field that's actually real, rather than
extending the schema speculatively. Recorded in README's "Deliberately
Deferred" section rather than silently narrowing the ADR's stated signal
set.
