import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CheckpointStore, type CheckpointState } from "../../src/core/checkpoint.js";

const EMPTY_STATE: CheckpointState = {
  velocity: { timestampsByActor: [], watermarkByActor: [] },
  firstSeenIps: { seenIpsByActor: [] },
  impossibleTravel: { lastByActor: [] },
  scopeEscalation: { seenScopesByActor: [] },
};

describe("CheckpointStore", () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "xylem-checkpoint-"));
    filePath = join(dir, "checkpoint.json");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when no checkpoint file exists yet", () => {
    const store = new CheckpointStore({ filePath });
    expect(store.load()).toBeNull();
  });

  it("round-trips a saved state", () => {
    const store = new CheckpointStore({ filePath });
    const state: CheckpointState = {
      velocity: { timestampsByActor: [["amanda", [0, 10_000]]], watermarkByActor: [["amanda", 10_000]] },
      firstSeenIps: { seenIpsByActor: [["amanda", ["10.0.0.1"]]] },
      impossibleTravel: { lastByActor: [["amanda", { atMs: 0, lat: 40.7128, lon: -74.006 }]] },
      scopeEscalation: { seenScopesByActor: [["amanda", ["repo:read"]]] },
    };

    store.save(state);
    expect(store.load()).toEqual(state);
  });

  it("overwrites the previous checkpoint on each save", () => {
    const store = new CheckpointStore({ filePath });
    store.save(EMPTY_STATE);
    const secondState: CheckpointState = {
      ...EMPTY_STATE,
      firstSeenIps: { seenIpsByActor: [["amanda", ["10.0.0.1"]]] },
    };
    store.save(secondState);

    expect(store.load()).toEqual(secondState);
  });

  it("writes the checkpoint file to disk", () => {
    const store = new CheckpointStore({ filePath });
    store.save(EMPTY_STATE);
    expect(existsSync(filePath)).toBe(true);
  });

  it("returns null for a checkpoint written under an incompatible schema version", () => {
    const store = new CheckpointStore({ filePath });
    store.save(EMPTY_STATE);
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    writeFileSync(filePath, JSON.stringify({ ...raw, version: 999 }), "utf8");

    expect(store.load()).toBeNull();
  });
});
