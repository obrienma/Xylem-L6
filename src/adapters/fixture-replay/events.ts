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
    sourceIp: "203.0.113.10",
    geo: { country: "US", lat: 40.7128, lon: -74.006 },
    outcome: "success",
    scopes: [],
    provider: "fixture-replay",
    tenant: "acme-corp",
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
 * - a new source IP for the same actor (evt-7) — exercises FirstSeenIpTracker
 *   flagging a first-seen IP after a baseline has already been established.
 * - a geo-implausible jump for the same actor, NYC to London an hour later
 *   (evt-8) — exercises ImpossibleTravelDetector.
 * - a scope baseline (evt-9) followed by a new, broader scope for the same
 *   actor (evt-10) — exercises ScopeEscalationTracker flagging escalation
 *   only after a baseline is established.
 * - a second synthetic tenant, "globex" (evt-11..13), interleaved with a
 *   "chen" actor id that collides with a distinct "acme-corp" "chen" — per
 *   ADR 0006, this demonstrates (not fixes) the single-tenant tracker-
 *   keying limitation: two real acme-corp events plus one globex event,
 *   sharing only an actor id, combine into a false velocity breach because
 *   SlidingWindowVelocityCounter keys on actor.id alone.
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
  {
    event: event({
      id: "evt-7",
      action: "repo.push",
      timestamp: new Date(iso(610_000)),
      sourceIp: "198.51.100.42",
    }),
    delayMs: 10,
  },
  {
    event: event({
      id: "evt-8",
      action: "repo.push",
      timestamp: new Date(iso(4_210_000)), // 1 hour after evt-7
      sourceIp: "198.51.100.42",
      geo: { country: "GB", lat: 51.5074, lon: -0.1278 },
    }),
    delayMs: 10,
  },
  {
    event: event({
      id: "evt-9",
      action: "repo.push",
      timestamp: new Date(iso(4_220_000)),
      sourceIp: "198.51.100.42",
      geo: { country: "GB", lat: 51.5074, lon: -0.1278 },
      scopes: ["repo:read"],
    }),
    delayMs: 10,
  },
  {
    event: event({
      id: "evt-10",
      action: "repo.admin.settings_update",
      timestamp: new Date(iso(4_230_000)),
      sourceIp: "198.51.100.42",
      geo: { country: "GB", lat: 51.5074, lon: -0.1278 },
      scopes: ["repo:read", "repo:admin"],
    }),
    delayMs: 10,
  },
  {
    event: event({
      id: "evt-11",
      action: "repo.push",
      timestamp: new Date(iso(5_000_000)),
      actor: { id: "chen", type: "user" },
      tenant: "acme-corp",
    }),
    delayMs: 10,
  },
  {
    event: event({
      id: "evt-12",
      action: "repo.push",
      timestamp: new Date(iso(5_010_000)),
      actor: { id: "chen", type: "user" },
      tenant: "globex",
      sourceIp: "192.0.2.77",
      geo: { country: "DE", lat: 52.52, lon: 13.405 },
    }),
    delayMs: 10,
  },
  {
    event: event({
      id: "evt-13",
      action: "repo.push",
      timestamp: new Date(iso(5_020_000)),
      actor: { id: "chen", type: "user" },
      tenant: "acme-corp",
    }),
    delayMs: 10,
  },
];
