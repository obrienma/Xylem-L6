import { describe, expect, it } from "vitest";
import { SlidingWindowVelocityCounter } from "../../src/core/window.js";

describe("SlidingWindowVelocityCounter", () => {
  it("counts events within the window for one actor", () => {
    const counter = new SlidingWindowVelocityCounter({ windowMs: 60_000 });
    expect(counter.record("amanda", 0)).toBe(1);
    expect(counter.record("amanda", 10_000)).toBe(2);
    expect(counter.record("amanda", 20_000)).toBe(3);
  });

  it("prunes events older than the window", () => {
    const counter = new SlidingWindowVelocityCounter({ windowMs: 60_000 });
    counter.record("amanda", 0);
    counter.record("amanda", 10_000);
    expect(counter.record("amanda", 70_001)).toBe(1);
  });

  it("tracks separate actors independently", () => {
    const counter = new SlidingWindowVelocityCounter({ windowMs: 60_000 });
    counter.record("amanda", 0);
    counter.record("amanda", 1_000);
    expect(counter.record("obrienma", 1_000)).toBe(1);
  });

  it("handles a late/out-of-order event without losing later entries", () => {
    const counter = new SlidingWindowVelocityCounter({ windowMs: 60_000 });
    counter.record("amanda", 0);
    counter.record("amanda", 61_000); // watermark now 61_000
    // A late event with an earlier timestamp arrives after the watermark advanced.
    const lateCount = counter.record("amanda", 30_000);
    expect(lateCount).toBe(2); // 0ms and 30_000ms both fall in (30_000-60_000, 30_000]

    // The later entry must not have been discarded by the late call.
    expect(counter.count("amanda", 61_000)).toBe(2); // 30_000ms and 61_000ms
  });

  it("count() does not mutate state", () => {
    const counter = new SlidingWindowVelocityCounter({ windowMs: 60_000 });
    counter.record("amanda", 0);
    counter.count("amanda", 500_000);
    expect(counter.count("amanda", 0)).toBe(1);
  });
});
