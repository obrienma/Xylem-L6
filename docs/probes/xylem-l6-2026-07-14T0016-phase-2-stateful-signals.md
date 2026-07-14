---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, idempotent-receiver, seen-set]
---
`FirstSeenIpTracker` and `ScopeEscalationTracker` reuse the same check-then-insert seen-set shape `GithubEventsLiveAdapter` already used for dedup — the formal pattern name is the `{{c1::idempotent receiver}}` — but invert which boolean outcome is interesting: dedup discards "already seen," novelty detection flags it.

Extra: xylem-l6 · Pattern: Idempotent Receiver (repurposed for novelty detection)
See: docs/journal/xylem-l6-2026-07-14T0016-phase-2-stateful-signals.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, running-state, sliding-window]
---
`SlidingWindowVelocityCounter` answers "how many recently" by `{{c1::evicting}}` timestamps older than the window; Phase 2's seen-set trackers answer "has this ever happened before" and must `{{c2::never evict}}` — eviction would silently reopen a security question the tracker already answered.

Extra: xylem-l6 · Pattern: Running State vs. Windowed State
See: docs/journal/xylem-l6-2026-07-14T0016-phase-2-stateful-signals.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, cold-start, false-positive]
---
`ScopeEscalationTracker` only reports `isEscalation: true` when the actor already `{{c1::had a scope baseline}}` before this call — without that guard, every actor's first-ever event would flag as escalation, since an empty seen-set makes every scope look new. This trap is the `{{c2::cold-start false positive}}`.

Extra: xylem-l6 · Anti-Pattern Avoided: Cold-Start False Positive
See: docs/journal/xylem-l6-2026-07-14T0016-phase-2-stateful-signals.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, first-seen, sourceip]
---
`FirstSeenIpTracker` deliberately skips the cold-start guard `ScopeEscalationTracker` uses — an actor's very first observed `{{c1::IP}}` is itself the useful signal, matching how real first-seen-device alerts fire on the very first login too.

Extra: xylem-l6 · Anti-Pattern Avoided: Cold-Start False Positive (contrast case)
See: docs/journal/xylem-l6-2026-07-14T0016-phase-2-stateful-signals.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, testing, fixture-data]
---
Q: Why did a spurious `[IMPOSSIBLE TRAVEL]` flag appear in the Phase 2 demo output for `evt-9`, an event only meant to establish a scope baseline — and why didn't any unit test catch it?

A: `evt-9` didn't override the fixture's shared `geo` default (NYC), so it silently inherited that instead of staying consistent with `evt-8`'s London coordinates set moments earlier. Combined with the short time gap, the implied travel speed exceeded the plausibility threshold. No per-tracker unit test caught it because each tracker's tests exercise it in isolation — only running the full `npm run dev` demo end-to-end, where all trackers process the same fixture stream together, surfaced the cross-signal interaction.

Extra: xylem-l6 · Challenge: Unintentional Cross-Signal Interaction in Fixture Data
See: docs/journal/xylem-l6-2026-07-14T0016-phase-2-stateful-signals.md

---
type: basic
deck: Rhizome::xylem-l6
tags: [xylem-l6, adr, adr-addendum]
---
Q: When ADR 0001's stated Phase 2 scope ("first-seen sets, impossible travel") conflicted with the README's pipeline diagram (which also tagged scope escalation as Phase 2), why resolve it with an ADR *addendum* rather than editing the ADR's original Phase 2 line directly?

A: Phase 1 had already been built against the ADR exactly as originally written, so editing that text in place would misrepresent what the architectural record said at the time those decisions were made. An addendum preserves the original text as a true historical record while making the resolved scope — scope escalation included, since it's mechanically the same seen-set shape as first-seen tracking — binding for Phase 2 going forward.

Extra: xylem-l6 · Decision: Resolve the ADR/README Scope Discrepancy via Addendum, Not Silent Interpretation
See: docs/journal/xylem-l6-2026-07-14T0016-phase-2-stateful-signals.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, commit-cadence]
---
Phase 2 shipped as `{{c1::one bundled commit and journal entry}}` covering all three signals, rather than three separate ones — matching Phase 1's precedent of bundling both adapters and the velocity counter into a single commit and entry.

Extra: xylem-l6 · Decision: Bundle All Three Signals into One Commit/Journal Entry
See: docs/journal/xylem-l6-2026-07-14T0016-phase-2-stateful-signals.md

---
type: cloze
deck: Rhizome::xylem-l6
tags: [xylem-l6, scope-decision, schema]
---
ADR 0001 names "first-seen IP/device/user-agent" as the full signal, but `FirstSeenIpTracker` covers `{{c1::IP only}}` — because `ApiActivityEvent` has no device/UA field and `{{c2::neither adapter would populate one}}` if it existed, so the schema wasn't extended speculatively.

Extra: xylem-l6 · Decision: First-Seen Tracking Is IP-Only, Not IP/Device/UA
See: docs/journal/xylem-l6-2026-07-14T0016-phase-2-stateful-signals.md
