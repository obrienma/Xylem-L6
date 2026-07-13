import { describe, expect, it } from "vitest";
import { FixtureReplayAdapter } from "../../src/adapters/fixture-replay/index.js";
import { defaultSchedule } from "../../src/adapters/fixture-replay/events.js";
import { ApiActivityEventSchema } from "../../src/core/types.js";

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
});
