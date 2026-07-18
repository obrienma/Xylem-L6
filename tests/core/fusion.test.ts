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
  it.each<{ name: string; input: FusionInput; score: number; signals: FusionSignal[]; firedCount: number }>([
    {
      name: "no signals fired",
      input: noSignals,
      score: 0,
      signals: [],
      firedCount: 0,
    },
    {
      name: "sub-threshold velocity scales linearly, doesn't gate on the breach flag",
      input: { ...noSignals, velocity: 1 },
      score: 1 / VELOCITY_BREACH_THRESHOLD,
      signals: ["velocity"],
      firedCount: 1,
    },
    {
      name: "velocity at or above threshold clamps to 1.0",
      input: { ...noSignals, velocity: VELOCITY_BREACH_THRESHOLD * 5 },
      score: 1,
      signals: ["velocity"],
      firedCount: 1,
    },
    {
      name: "first-seen IP is a boolean signal: fires at 1.0",
      input: { ...noSignals, isFirstSeenIp: true },
      score: 1,
      signals: ["firstSeenIp"],
      firedCount: 1,
    },
    {
      name: "scope escalation is a boolean signal: fires at 1.0",
      input: { ...noSignals, scopeEscalation: { newScopes: ["repo:admin"], isEscalation: true } },
      score: 1,
      signals: ["scopeEscalation"],
      firedCount: 1,
    },
    {
      name: "sub-threshold travel speed scales linearly, even when not flagged impossible",
      input: {
        ...noSignals,
        impossibleTravel: { distanceKm: 100, speedKmh: MAX_PLAUSIBLE_SPEED_KMH / 2, isImpossible: false },
      },
      score: 0.5,
      signals: ["impossibleTravel"],
      firedCount: 1,
    },
    {
      name: "travel speed above threshold clamps to 1.0",
      input: {
        ...noSignals,
        impossibleTravel: { distanceKm: 5000, speedKmh: MAX_PLAUSIBLE_SPEED_KMH * 3, isImpossible: true },
      },
      score: 1,
      signals: ["impossibleTravel"],
      firedCount: 1,
    },
    {
      name: "no baseline for travel (null result) contributes zero severity",
      input: { ...noSignals, impossibleTravel: null },
      score: 0,
      signals: [],
      firedCount: 0,
    },
    {
      name: "the maximum wins over a simultaneously weaker signal, but firedCount still counts both",
      input: { ...noSignals, velocity: 1, isFirstSeenIp: true },
      score: 1,
      signals: ["firstSeenIp"],
      firedCount: 2,
    },
    {
      name: "a genuine tie names every signal that produced the max",
      input: { ...noSignals, isFirstSeenIp: true, scopeEscalation: { newScopes: ["x"], isEscalation: true } },
      score: 1,
      signals: ["firstSeenIp", "scopeEscalation"],
      firedCount: 2,
    },
    {
      name: "two signals tied at the same sub-threshold severity both appear in signals",
      input: {
        velocity: 1, // severity 1/3
        isFirstSeenIp: false,
        impossibleTravel: { distanceKm: 10, speedKmh: MAX_PLAUSIBLE_SPEED_KMH / 3, isImpossible: false }, // severity 1/3
        scopeEscalation: { newScopes: [], isEscalation: false },
      },
      score: 1 / VELOCITY_BREACH_THRESHOLD,
      signals: ["velocity", "impossibleTravel"],
      firedCount: 2,
    },
  ])("$name", ({ input, score, signals, firedCount }) => {
    const result = fuseSignals(input);
    expect(result.score).toBeCloseTo(score);
    expect(result.signals).toEqual(signals);
    expect(result.firedCount).toBe(firedCount);
  });

  it("is a pure function: same input always produces the same output", () => {
    const input: FusionInput = { ...noSignals, velocity: 2 };
    expect(fuseSignals(input)).toEqual(fuseSignals(input));
  });

  it("ADR 0005's known weakness, made visible: one signal alone and several signals together can share a score but not a firedCount", () => {
    const oneSignal = fuseSignals({ ...noSignals, isFirstSeenIp: true });
    const fourSignals = fuseSignals({
      velocity: 1, // weak: severity 1/3, well under the max
      isFirstSeenIp: true, // boolean: fires at 1.0, same as oneSignal's case
      impossibleTravel: { distanceKm: 10, speedKmh: MAX_PLAUSIBLE_SPEED_KMH / 2, isImpossible: false }, // weak: severity 0.5
      scopeEscalation: { newScopes: ["repo:admin"], isEscalation: true }, // boolean: fires at 1.0
    });

    expect(oneSignal.score).toBe(fourSignals.score);
    expect(oneSignal.firedCount).toBe(1);
    expect(fourSignals.firedCount).toBe(4);
  });
});
