import { describe, expect, it } from "vitest";
import { fuseSignals, type FusionInput, type FusionSignal } from "../../src/core/fusion.js";
import { VELOCITY_BREACH_THRESHOLD, MAX_PLAUSIBLE_SPEED_KMH } from "../../src/core/thresholds.js";

const noSignals: FusionInput = {
  velocity: 0,
  isFirstSeenIp: false,
  impossibleTravel: null,
  scopeEscalation: { newScopes: [], isEscalation: false },
};

describe("fuseSignals", () => {
  it.each<{ name: string; input: FusionInput; score: number; signals: FusionSignal[] }>([
    {
      name: "no signals fired",
      input: noSignals,
      score: 0,
      signals: [],
    },
    {
      name: "sub-threshold velocity scales linearly, doesn't gate on the breach flag",
      input: { ...noSignals, velocity: 1 },
      score: 1 / VELOCITY_BREACH_THRESHOLD,
      signals: ["velocity"],
    },
    {
      name: "velocity at or above threshold clamps to 1.0",
      input: { ...noSignals, velocity: VELOCITY_BREACH_THRESHOLD * 5 },
      score: 1,
      signals: ["velocity"],
    },
    {
      name: "first-seen IP is a boolean signal: fires at 1.0",
      input: { ...noSignals, isFirstSeenIp: true },
      score: 1,
      signals: ["firstSeenIp"],
    },
    {
      name: "scope escalation is a boolean signal: fires at 1.0",
      input: { ...noSignals, scopeEscalation: { newScopes: ["repo:admin"], isEscalation: true } },
      score: 1,
      signals: ["scopeEscalation"],
    },
    {
      name: "sub-threshold travel speed scales linearly, even when not flagged impossible",
      input: {
        ...noSignals,
        impossibleTravel: { distanceKm: 100, speedKmh: MAX_PLAUSIBLE_SPEED_KMH / 2, isImpossible: false },
      },
      score: 0.5,
      signals: ["impossibleTravel"],
    },
    {
      name: "travel speed above threshold clamps to 1.0",
      input: {
        ...noSignals,
        impossibleTravel: { distanceKm: 5000, speedKmh: MAX_PLAUSIBLE_SPEED_KMH * 3, isImpossible: true },
      },
      score: 1,
      signals: ["impossibleTravel"],
    },
    {
      name: "no baseline for travel (null result) contributes zero severity",
      input: { ...noSignals, impossibleTravel: null },
      score: 0,
      signals: [],
    },
    {
      name: "the maximum wins over a simultaneously weaker signal",
      input: { ...noSignals, velocity: 1, isFirstSeenIp: true },
      score: 1,
      signals: ["firstSeenIp"],
    },
    {
      name: "a genuine tie names every signal that produced the max",
      input: { ...noSignals, isFirstSeenIp: true, scopeEscalation: { newScopes: ["x"], isEscalation: true } },
      score: 1,
      signals: ["firstSeenIp", "scopeEscalation"],
    },
  ])("$name", ({ input, score, signals }) => {
    const result = fuseSignals(input);
    expect(result.score).toBeCloseTo(score);
    expect(result.signals).toEqual(signals);
  });

  it("is a pure function: same input always produces the same output", () => {
    const input: FusionInput = { ...noSignals, velocity: 2 };
    expect(fuseSignals(input)).toEqual(fuseSignals(input));
  });
});
