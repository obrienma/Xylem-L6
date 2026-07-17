import { describe, expect, it } from "vitest";
import { FixtureReplayAdapter } from "../../src/adapters/fixture-replay/index.js";
import { defaultSchedule } from "../../src/adapters/fixture-replay/events.js";
import { ApiActivityEventSchema } from "../../src/core/types.js";
import { SlidingWindowVelocityCounter } from "../../src/core/window.js";

describe("FixtureReplayAdapter", () => {
  it("emits events in schedule order, decoupled from each event's own timestamp", async () => {
    const adapter = new FixtureReplayAdapter({
      schedule: [
        { event: { ...defaultSchedule[0]!.event, id: "a", timestamp: new Date(1000) }, delayMs: 0 },
        { event: { ...defaultSchedule[0]!.event, id: "b", timestamp: new Date(0) }, delayMs: 0 },
      ],
    });

    const ids: string[] = [];
    for await (const event of adapter.stream()) {
      ids.push(event.id);
    }

    expect(ids).toEqual(["a", "b"]);
  });

  it("the default sample schedule is schema-valid and includes a late/out-of-order event", () => {
    for (const entry of defaultSchedule) {
      expect(ApiActivityEventSchema.safeParse(entry.event).success).toBe(true);
    }

    const timestamps = defaultSchedule.map((e) => e.event.timestamp.getTime());
    const emissionIsSorted = timestamps.every((t, i) => i === 0 || t >= timestamps[i - 1]!);
    expect(emissionIsSorted).toBe(false);
  });

  it("includes events from at least two distinct tenants (ADR 0006)", () => {
    const tenants = new Set(defaultSchedule.map((e) => e.event.tenant));
    expect(tenants.size).toBeGreaterThanOrEqual(2);
    expect(tenants.has("acme-corp")).toBe(true);
    expect(tenants.has("globex")).toBe(true);
  });

  it("demonstrates the single-tenant tracker-keying limitation: a shared actor id across tenants produces a false velocity breach (ADR 0006)", () => {
    const chenEvents = defaultSchedule
      .map((e) => e.event)
      .filter((e) => e.actor.id === "chen")
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    expect(chenEvents.map((e) => e.tenant)).toEqual(["acme-corp", "globex", "acme-corp"]);

    const counter = new SlidingWindowVelocityCounter({ windowMs: 120_000 });
    const velocities = chenEvents.map((e) => counter.record(e.actor.id, e.timestamp.getTime()));

    // The third event breaches the threshold used elsewhere in this project
    // (index.ts's VELOCITY_BREACH_THRESHOLD = 3) even though only two of the
    // three events belong to the same real tenant — the counter can't tell,
    // because it keys on actor.id alone. This is the limitation ADR 0006
    // documents and defers, not a bug this test is asserting should be fixed.
    expect(velocities).toEqual([1, 2, 3]);
  });
});
