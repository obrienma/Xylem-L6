import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { SlidingWindowVelocityCounterState } from "./window.js";
import type { FirstSeenIpTrackerState } from "./firstSeen.js";
import type { ImpossibleTravelDetectorState } from "./impossibleTravel.js";
import type { ScopeEscalationTrackerState } from "./scopeEscalation.js";

const CHECKPOINT_SCHEMA_VERSION = 1;

export interface CheckpointState {
  velocity: SlidingWindowVelocityCounterState;
  firstSeenIps: FirstSeenIpTrackerState;
  impossibleTravel: ImpossibleTravelDetectorState;
  scopeEscalation: ScopeEscalationTrackerState;
}

interface CheckpointFile {
  version: number;
  state: CheckpointState;
}

export interface CheckpointStoreOptions {
  filePath: string;
}

/**
 * Persists the combined state of all trackers to a single JSON file, so a
 * process restart resumes from where it left off instead of silently
 * dropping in-flight window/state (ADR 0001, Phase 3). Saved synchronously
 * after every event — at this project's demo-scale throughput, per-event
 * checkpointing is simpler than interval/dirty-flag debouncing and has no
 * durability gap. `save` is the one call site the rest of the codebase uses,
 * so swapping the cadence or backing store later is a single-site change.
 */
export class CheckpointStore {
  private readonly filePath: string;

  constructor(options: CheckpointStoreOptions) {
    this.filePath = options.filePath;
  }

  save(state: CheckpointState): void {
    const file: CheckpointFile = { version: CHECKPOINT_SCHEMA_VERSION, state };
    writeFileSync(this.filePath, JSON.stringify(file), "utf8");
  }

  /** Returns null if no checkpoint file exists yet, or if it's from an incompatible schema version. */
  load(): CheckpointState | null {
    if (!existsSync(this.filePath)) return null;

    const file = JSON.parse(readFileSync(this.filePath, "utf8")) as CheckpointFile;
    if (file.version !== CHECKPOINT_SCHEMA_VERSION) return null;

    return file.state;
  }
}
