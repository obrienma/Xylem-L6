import type { ActivityAdapter } from "./core/adapter.js";
import { SlidingWindowVelocityCounter } from "./core/window.js";
import { FixtureReplayAdapter } from "./adapters/fixture-replay/index.js";
import { GithubEventsLiveAdapter } from "./adapters/github-events-live/index.js";

const WINDOW_MS = 120_000;
const VELOCITY_BREACH_THRESHOLD = 3;

function resolveAdapter(): ActivityAdapter {
  const which = process.env.XYLEM_ADAPTER ?? "fixture-replay";

  if (which === "github-events-live") {
    const username = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_TOKEN;
    if (!username || !token) {
      throw new Error("github-events-live requires GITHUB_USERNAME and GITHUB_TOKEN env vars");
    }
    return new GithubEventsLiveAdapter({ username, token });
  }

  if (which !== "fixture-replay") {
    throw new Error(`Unknown XYLEM_ADAPTER: ${which}`);
  }

  return new FixtureReplayAdapter();
}

async function main(): Promise<void> {
  const adapter = resolveAdapter();
  const counter = new SlidingWindowVelocityCounter({ windowMs: WINDOW_MS });

  console.log(`Xylem-L6 — Phase 1 demo, adapter: ${adapter.name}, window: ${WINDOW_MS}ms`);

  for await (const activityEvent of adapter.stream()) {
    const velocity = counter.record(activityEvent.actor.id, activityEvent.timestamp.getTime());
    const breach = velocity >= VELOCITY_BREACH_THRESHOLD ? " [VELOCITY BREACH]" : "";
    console.log(
      `${activityEvent.timestamp.toISOString()} actor=${activityEvent.actor.id} action=${activityEvent.action} velocity=${velocity}${breach}`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
