import type { ActivityAdapter } from "../../core/adapter.js";
import type { ApiActivityEvent } from "../../core/types.js";

export class GithubEventsLiveAdapter implements ActivityAdapter {
  readonly name = "github-events-live";

  async *stream(): AsyncIterable<ApiActivityEvent> {
    throw new Error("GithubEventsLiveAdapter.stream() not implemented — Phase 1 (ADR 0001)");
  }
}
