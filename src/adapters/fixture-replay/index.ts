import type { ActivityAdapter } from "../../core/adapter.js";
import type { ApiActivityEvent } from "../../core/types.js";
import { sleep } from "../../core/sleep.js";
import { defaultSchedule, type FixtureScheduleEntry } from "./events.js";

export interface FixtureReplayOptions {
  /** Defaults to the built-in sample schedule (baseline, burst, gap, late arrival). */
  schedule?: FixtureScheduleEntry[];
  /** Random +/- jitter (ms) applied to each entry's delay. */
  jitterMs?: number;
}

export class FixtureReplayAdapter implements ActivityAdapter {
  readonly name = "fixture-replay";

  private readonly schedule: FixtureScheduleEntry[];
  private readonly jitterMs: number;

  constructor(options: FixtureReplayOptions = {}) {
    this.schedule = options.schedule ?? defaultSchedule;
    this.jitterMs = options.jitterMs ?? 0;
  }

  async *stream(): AsyncIterable<ApiActivityEvent> {
    for (const entry of this.schedule) {
      const delay = Math.max(0, entry.delayMs + this.jitter());
      if (delay > 0) {
        await sleep(delay);
      }
      yield entry.event;
    }
  }

  private jitter(): number {
    if (this.jitterMs <= 0) return 0;
    return Math.round((Math.random() * 2 - 1) * this.jitterMs);
  }
}
