import type { ActivityAdapter } from "../../core/adapter.js";
import { ApiActivityEventSchema, type ApiActivityEvent } from "../../core/types.js";
import { sleep } from "../../core/sleep.js";

interface GithubEvent {
  id: string;
  type: string;
  actor: { login: string };
  repo: { name: string };
  created_at: string;
}

export interface GithubEventsLiveOptions {
  username: string;
  token: string;
  pollIntervalMs?: number;
  /** Injectable for testing — mock at this boundary, never the class internals. */
  fetchImpl?: typeof fetch;
}

/**
 * Public GitHub Events API only — no auth/session-level events, so
 * failed-auth-burst and impossible-travel signals (Phase 2) can't be
 * demonstrated against this adapter. See ADR 0001.
 */
export class GithubEventsLiveAdapter implements ActivityAdapter {
  readonly name = "github-events-live";

  private readonly username: string;
  private readonly token: string;
  private readonly pollIntervalMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly seenEventIds = new Set<string>();

  constructor(options: GithubEventsLiveOptions) {
    this.username = options.username;
    this.token = options.token;
    this.pollIntervalMs = options.pollIntervalMs ?? 60_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async *stream(): AsyncIterable<ApiActivityEvent> {
    for (;;) {
      const events = await this.pollOnce();
      for (const event of events) {
        yield event;
      }
      await sleep(this.pollIntervalMs);
    }
  }

  /** One poll cycle: fetch, dedupe against events already seen, map to ApiActivityEvent. Exposed for testing. */
  async pollOnce(): Promise<ApiActivityEvent[]> {
    const response = await this.fetchImpl(`https://api.github.com/users/${this.username}/events`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub Events API request failed: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as GithubEvent[];
    const fresh: ApiActivityEvent[] = [];

    // GitHub returns newest-first; emit oldest-first so downstream windowing sees increasing event time.
    for (const raw of [...payload].reverse()) {
      if (this.seenEventIds.has(raw.id)) continue;
      this.seenEventIds.add(raw.id);
      fresh.push(this.mapEvent(raw));
    }

    return fresh;
  }

  private mapEvent(raw: GithubEvent): ApiActivityEvent {
    return ApiActivityEventSchema.parse({
      id: raw.id,
      timestamp: raw.created_at,
      actor: { id: raw.actor.login, type: "user" },
      action: raw.type,
      resource: raw.repo.name,
      outcome: "success",
      scopes: [],
      provider: "github-events-live",
    });
  }
}
