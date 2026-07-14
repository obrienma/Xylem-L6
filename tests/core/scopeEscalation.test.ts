import { describe, expect, it } from "vitest";
import { ScopeEscalationTracker } from "../../src/core/scopeEscalation.js";

describe("ScopeEscalationTracker", () => {
  it("does not flag the actor's very first event as escalation", () => {
    const tracker = new ScopeEscalationTracker();
    const result = tracker.record("amanda", ["repo:read"]);
    expect(result.newScopes).toEqual(["repo:read"]);
    expect(result.isEscalation).toBe(false);
  });

  it("does not flag a repeat of already-seen scopes", () => {
    const tracker = new ScopeEscalationTracker();
    tracker.record("amanda", ["repo:read"]);
    const result = tracker.record("amanda", ["repo:read"]);
    expect(result.newScopes).toEqual([]);
    expect(result.isEscalation).toBe(false);
  });

  it("flags a new scope appearing after a baseline is established", () => {
    const tracker = new ScopeEscalationTracker();
    tracker.record("amanda", ["repo:read"]);
    const result = tracker.record("amanda", ["repo:read", "repo:admin"]);
    expect(result.newScopes).toEqual(["repo:admin"]);
    expect(result.isEscalation).toBe(true);
  });

  it("treats a baseline event with an empty scope list as no baseline yet", () => {
    const tracker = new ScopeEscalationTracker();
    tracker.record("amanda", []);
    const result = tracker.record("amanda", ["repo:admin"]);
    expect(result.isEscalation).toBe(false);
  });

  it("tracks separate actors independently", () => {
    const tracker = new ScopeEscalationTracker();
    tracker.record("amanda", ["repo:read"]);
    const result = tracker.record("obrienma", ["repo:admin"]);
    expect(result.isEscalation).toBe(false);
  });

  it("round-trips state through getState/loadState", () => {
    const tracker = new ScopeEscalationTracker();
    tracker.record("amanda", ["repo:read"]);

    const restored = new ScopeEscalationTracker();
    restored.loadState(tracker.getState());

    const result = restored.record("amanda", ["repo:read", "repo:admin"]);
    expect(result.newScopes).toEqual(["repo:admin"]);
    expect(result.isEscalation).toBe(true);
  });
});
