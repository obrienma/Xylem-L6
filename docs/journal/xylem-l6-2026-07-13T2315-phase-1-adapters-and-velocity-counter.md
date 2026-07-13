---
id: xylem-l6-2026-07-13T2315-phase-1-adapters-and-velocity-counter
repo: xylem-l6
title: "Phase 1: Real Adapters and the Sliding-Window Velocity Counter"
date: 2026-07-13
phase: 1
tags: [typescript, zod, vitest, event-time-processing, watermark, sliding-window, ports-and-adapters, allowed-lateness]
files: [src/core/window.ts, src/core/sleep.ts, src/adapters/fixture-replay/events.ts, src/adapters/fixture-replay/index.ts, src/adapters/github-events-live/index.ts, src/index.ts, tests/core/window.test.ts, tests/adapters/fixture-replay.test.ts, tests/adapters/github-events-live.test.ts, tests/arch.test.ts, README.md, CLAUDE.md]
---

### Pattern: Event-Time Processing (vs. Processing-Time)

`SlidingWindowVelocityCounter` windows on the `atMs` value passed per call — each event's own timestamp — never on wall-clock time at the moment `record()` runs. `fixture-replay`'s schedule exploits this deliberately: emission order (`delayMs` between yields) is fully decoupled from each event's own `timestamp` field, so a test can make an "old" event arrive last. Without event-time semantics, that event would land in whatever window happens to be current at the moment it's processed — wrong by construction. This is the same distinction Flink/Beam formalize as event-time vs. processing-time windowing; Xylem-L6 exists specifically to rehearse it.

### Pattern: Watermark-Governed Retention with a Fixed Allowed-Lateness Bound

Per actor, a watermark (max event time seen so far) governs how much history `SlidingWindowVelocityCounter` retains — not just `windowMs` behind the watermark, but `2 × windowMs`. The extra factor exists because a late event can itself have an `atMs` up to one `windowMs` behind the watermark, and *that* event's own trailing window then reaches a further `windowMs` back from there. Retaining only `windowMs` (the first version) silently undercounted exactly this case. `2 × windowMs` is a fixed stand-in for what real stream processors expose as an explicit "allowed lateness" parameter, independent of window size — see Decision below for why that simplification was kept rather than generalized now.

### Anti-Pattern Avoided: Arrival-Order-Only Pruning

The tempting simpler implementation prunes strictly by processing order — drop anything older than `windowMs` behind *the current call's* `atMs`, full stop. That's correct only when events arrive in timestamp order. The first watermark-based version avoided this trap in spirit but still under-retained (see Challenge below); the fix keeps a wider retention margin precisely so an out-of-order call can't be starved of data a same-or-earlier watermark position already knew about.

### Challenge: Watermark Retention Silently Dropped Data a Late Event Still Needed

**Symptom:** `tests/core/window.test.ts`'s out-of-order test failed — `expected 1 to be 2`. A late event (`atMs=30_000`) arriving after the watermark had advanced to `61_000` reported a velocity of 1 instead of 2; a follow-up assertion showed the *earlier* entry (`atMs=0`) had vanished from storage entirely, not just from that one count.

**Root cause:** The first retention rule kept only entries within `windowMs` of the watermark (`watermark - windowMs`). At watermark `61_000` with `windowMs=60_000`, the cutoff was `1_000` — so the `0`-ms entry, still needed to correctly answer a query at `atMs=30_000` (whose own window reaches back to `-30_000`), had already been pruned by the time that late call arrived. Retention was sized for "how far back does the *current* watermark's window reach," not "how far back could a *still-valid* late call's window reach."

**Fix:** Widened retention to `2 × windowMs` behind the watermark — see the Pattern above for why that specific factor. The manual demo run (`npm run dev`, fixture-replay) also surfaced the boundary case live: a genuinely late event arriving 10 minutes behind the watermark (`windowMs=120_000`, well past the one-`windowMs` lateness bound) correctly reported `velocity=0` rather than crashing or over-counting — the documented limit doing exactly what it says.

### Decision: Fixed `2×windowMs` Retention, Not a Separate `allowedLateness` Parameter

Considered adding an explicit `allowedLateness` config independent of `windowMs`, matching how Flink/Beam actually expose this. Chose the fixed `2×windowMs` rule instead — confirmed after the fact as the right call for Phase 1's scope: ADR 0001 asks for "an in-memory sliding-window velocity counter," not a fully general late-data policy, and a real `allowedLateness` knob has no consumer yet to justify its shape (would it be a duration? a count? per-signal?). Revisit if Phase 2's first-seen/impossible-travel signals need a different lateness tolerance than velocity does — that's the concrete trigger for generalizing this, not doing it speculatively now.

### Decision: `fetchImpl` Injection as the GitHub Adapter's Test Boundary

`GithubEventsLiveAdapter` takes an optional `fetchImpl` (defaulting to global `fetch`) and exposes `pollOnce()` separately from the infinite `stream()` loop, specifically so tests can mock at the interface boundary (per this repo's `CLAUDE.md` testing rule) without ever touching real network I/O or fighting an unterminated async generator in a test runner. A `vi.spyOn(globalThis, "fetch")` assertion in the test suite verifies the real `fetch` is never called, not just that the mock was — the thing actually worth confirming.
