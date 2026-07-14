---
id: xylem-l6-2026-07-13T2035-phase-3-checkpointing
repo: xylem-l6
title: "Xylem-L6 Phase 3 (checkpointing)"
date: 2026-07-13
phase: 3
tags: [memento-pattern, checkpointing, schema-versioning, cold-start, watermark, snapshot]
files:
  - src/core/checkpoint.ts
  - src/core/window.ts
  - src/core/firstSeen.ts
  - src/core/impossibleTravel.ts
  - src/core/scopeEscalation.ts
  - src/index.ts
  - README.md
  - .gitignore
  - tests/core/checkpoint.test.ts
  - tests/core/window.test.ts
  - tests/core/firstSeen.test.ts
  - tests/core/impossibleTravel.test.ts
  - tests/core/scopeEscalation.test.ts
---

### Pattern: Memento (State Externalization)
Each of the four trackers — `SlidingWindowVelocityCounter`, `FirstSeenIpTracker`,
`ImpossibleTravelDetector`, `ScopeEscalationTracker` — gained a `getState()`/
`loadState()` pair implementing the **Memento** pattern: an object's internal
state (its private `Map`/`Set` fields) is externalized into a plain,
JSON-serializable snapshot without exposing or restructuring how the object
itself works internally. `CheckpointStore` is the caretaker in the classic
Memento vocabulary — it persists and retrieves the memento (the bundled
`CheckpointState`) without inspecting or depending on what's inside it, only
on the fact that it round-trips through JSON.

### Anti-Pattern Avoided: Silent Schema Drift on Checkpoint Restore
The tempting shortcut was to just `JSON.parse` the checkpoint file on startup
and trust its shape. The failure mode that avoids: if a future phase changes
any tracker's internal state shape, an old checkpoint file would either throw
deep inside `Map`/`Set` reconstruction, or worse, silently produce corrupted
per-actor state that only misbehaves later, far from the point of failure.
`CheckpointStore` writes a `version` field alongside the state; `load()`
checks it and returns `null` on any mismatch, which the caller already
treats as "no checkpoint" — a schema-incompatible file degrades to a clean
cold start instead of a crash or silent corruption.

### Challenge: Watermark Omission Would Silently Reset Late-Event Handling
`SlidingWindowVelocityCounter` carries two parallel per-actor maps:
`timestampsByActor` (what `count()` reads) and `watermarkByActor` (which
governs retention and late-event admission inside `record()`). The initial
instinct was to serialize just `timestampsByActor`, since that's the one
visibly consumed by `count()` — but `record()`'s retention window is computed
relative to the watermark, not the max of whatever timestamps happen to be
retained. Restoring timestamps while leaving the watermark at its zero-value
default would make `record()` treat every restored historical timestamp as
being *ahead of* the reset watermark, silently corrupting late-event
admission on the very first event after a restart — reintroducing, via
checkpoint restore, exactly the class of bug Phase 1's watermark logic was
built to prevent during live out-of-order arrival. Fixed by serializing
`watermarkByActor` as its own map in `getState()`/`loadState()`, and by
writing a dedicated test that restores state and then feeds a late event
through `record()`, not just a plain `count()` check, since a plain count
check wouldn't have caught this.

### Decision: Checkpoint After Every Event, Not on an Interval
`CheckpointStore.save()` writes synchronously to disk after every event is
processed, rather than debouncing on a timer or a dirty-flag. Tradeoff: at
higher throughput this is far more filesystem writes than necessary — that's
deliberately accepted, not overlooked. At Xylem-L6's actual scale (a single
fixture replay or one personal GitHub account's event rate), the durability
benefit — zero gap between the last processed event and the last persisted
state — outweighs the I/O cost, and a timer/dirty-flag abstraction would be
solving a throughput problem this project doesn't have yet. The upgrade path
is kept cheap on purpose: every checkpoint write already routes through one
call site (`checkpoint.save(...)` in `index.ts`), so swapping the cadence or
the backing store later is a single-site change, not a refactor.

### Decision: Single JSON File, Local Disk, Versioned Schema
All four trackers' state is bundled into one `.xylem-checkpoint.json` file
(gitignored), not one file per tracker and not a database. This is an
explicit placeholder for the Phase 4+ GCP Firestore checkpoint store named in
ADR 0001 and ADR 0003 — Phase 3 deliberately doesn't try to anticipate
Firestore's document shape or multi-instance semantics. It solves "a single
process restarting on one machine," full stop, and defers the
multi-instance/ephemeral-GKE-pod case to whenever GCP deployment is actually
built, consistent with the project's standing preference for solving the
problem in front of it rather than the one on the roadmap.
