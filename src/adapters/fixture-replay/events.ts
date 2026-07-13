import type { ApiActivityEvent } from "../../core/types.js";

export interface FixtureScheduleEntry {
  /** The event to emit, including its own (possibly out-of-order) timestamp. */
  event: ApiActivityEvent;
  /** Wait this long, relative to the previous emission, before yielding this event. */
  delayMs: number;
}

const base = Date.parse("2026-07-13T12:00:00.000Z");
const iso = (offsetMs: number) => new Date(base + offsetMs).toISOString();

function event(overrides: Partial<ApiActivityEvent> & { id: string; action: string }): ApiActivityEvent {
  return {
    timestamp: new Date(base),
    actor: { id: "amanda", type: "user" },
    resource: "repo:obrienma/xylem-l6",
    outcome: "success",
    scopes: [],
    provider: "fixture-replay",
    ...overrides,
  } as ApiActivityEvent;
}

/**
 * Hand-authored to force specific windowing conditions on demand:
 * - a quiet baseline (evt-1)
 * - a burst of 3 events for the same actor within a few seconds (evt-2..4)
 * - a gap of several minutes (evt-5)
 * - a late/out-of-order arrival: emitted last, but its own timestamp falls
 *   inside the earlier burst window (evt-6) — exercises the watermark-based
 *   retention in SlidingWindowVelocityCounter.
 */
export const defaultSchedule: FixtureScheduleEntry[] = [
  {
    event: event({ id: "evt-1", action: "repo.push", timestamp: new Date(iso(0)) }),
    delayMs: 0,
  },
  {
    event: event({ id: "evt-2", action: "repo.push", timestamp: new Date(iso(60_000)) }),
    delayMs: 10,
  },
  {
    event: event({ id: "evt-3", action: "repo.push", timestamp: new Date(iso(61_000)) }),
    delayMs: 10,
  },
  {
    event: event({ id: "evt-4", action: "repo.push", timestamp: new Date(iso(62_000)) }),
    delayMs: 10,
  },
  {
    event: event({ id: "evt-5", action: "issue.comment", timestamp: new Date(iso(600_000)) }),
    delayMs: 10,
  },
  {
    event: event({ id: "evt-6", action: "repo.push", timestamp: new Date(iso(61_500)) }),
    delayMs: 10,
  },
];
