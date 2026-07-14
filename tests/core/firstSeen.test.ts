import { describe, expect, it } from "vitest";
import { FirstSeenIpTracker } from "../../src/core/firstSeen.js";

describe("FirstSeenIpTracker", () => {
  it("flags the first IP seen for an actor", () => {
    const tracker = new FirstSeenIpTracker();
    expect(tracker.record("amanda", "10.0.0.1")).toBe(true);
  });

  it("does not re-flag an IP already seen for that actor", () => {
    const tracker = new FirstSeenIpTracker();
    tracker.record("amanda", "10.0.0.1");
    expect(tracker.record("amanda", "10.0.0.1")).toBe(false);
  });

  it("flags a second, different IP for the same actor", () => {
    const tracker = new FirstSeenIpTracker();
    tracker.record("amanda", "10.0.0.1");
    expect(tracker.record("amanda", "10.0.0.2")).toBe(true);
  });

  it("tracks separate actors independently", () => {
    const tracker = new FirstSeenIpTracker();
    tracker.record("amanda", "10.0.0.1");
    expect(tracker.record("obrienma", "10.0.0.1")).toBe(true);
  });
});
