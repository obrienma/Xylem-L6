import type { ActivityAdapter } from "../../core/adapter.js";
import type { ApiActivityEvent } from "../../core/types.js";

export class FixtureReplayAdapter implements ActivityAdapter {
  readonly name = "fixture-replay";

  async *stream(): AsyncIterable<ApiActivityEvent> {
    throw new Error("FixtureReplayAdapter.stream() not implemented — Phase 1 (ADR 0001)");
  }
}
