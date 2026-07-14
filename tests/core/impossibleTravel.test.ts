import { describe, expect, it } from "vitest";
import { haversineDistanceKm, ImpossibleTravelDetector } from "../../src/core/impossibleTravel.js";

describe("haversineDistanceKm", () => {
  it("computes ~0 distance for the same point", () => {
    expect(haversineDistanceKm(40.7128, -74.006, 40.7128, -74.006)).toBeCloseTo(0, 3);
  });

  it("computes a known distance (NYC to London, ~5570km)", () => {
    const distance = haversineDistanceKm(40.7128, -74.006, 51.5074, -0.1278);
    expect(distance).toBeGreaterThan(5500);
    expect(distance).toBeLessThan(5600);
  });
});

describe("ImpossibleTravelDetector", () => {
  it("returns null on an actor's first geo-tagged event (no baseline yet)", () => {
    const detector = new ImpossibleTravelDetector({ maxPlausibleSpeedKmh: 900 });
    expect(detector.record("amanda", 0, 40.7128, -74.006)).toBeNull();
  });

  it("does not flag plausible travel (short distance, ample time)", () => {
    const detector = new ImpossibleTravelDetector({ maxPlausibleSpeedKmh: 900 });
    detector.record("amanda", 0, 40.7128, -74.006); // NYC
    const result = detector.record("amanda", 3_600_000, 40.73, -74.0); // ~1 hour later, still NYC
    expect(result?.isImpossible).toBe(false);
  });

  it("flags impossible travel (NYC to London in 1 hour)", () => {
    const detector = new ImpossibleTravelDetector({ maxPlausibleSpeedKmh: 900 });
    detector.record("amanda", 0, 40.7128, -74.006); // NYC
    const result = detector.record("amanda", 3_600_000, 51.5074, -0.1278); // London, 1 hour later
    expect(result?.isImpossible).toBe(true);
    expect(result?.speedKmh).toBeGreaterThan(900);
  });

  it("tracks separate actors independently", () => {
    const detector = new ImpossibleTravelDetector({ maxPlausibleSpeedKmh: 900 });
    detector.record("amanda", 0, 40.7128, -74.006);
    expect(detector.record("obrienma", 0, 51.5074, -0.1278)).toBeNull();
  });
});
