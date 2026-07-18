import type { ActivityAdapter } from "./core/adapter.js";
import { SlidingWindowVelocityCounter } from "./core/window.js";
import { FirstSeenIpTracker } from "./core/firstSeen.js";
import { ImpossibleTravelDetector } from "./core/impossibleTravel.js";
import { ScopeEscalationTracker } from "./core/scopeEscalation.js";
import { CheckpointStore } from "./core/checkpoint.js";
import { VELOCITY_BREACH_THRESHOLD, MAX_PLAUSIBLE_SPEED_KMH } from "./core/thresholds.js";
import { FixtureReplayAdapter } from "./adapters/fixture-replay/index.js";
import { GithubEventsLiveAdapter } from "./adapters/github-events-live/index.js";

const WINDOW_MS = 120_000;
const CHECKPOINT_FILE_PATH = process.env.XYLEM_CHECKPOINT_FILE ?? ".xylem-checkpoint.json";

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
  const firstSeenIps = new FirstSeenIpTracker();
  const impossibleTravel = new ImpossibleTravelDetector({ maxPlausibleSpeedKmh: MAX_PLAUSIBLE_SPEED_KMH });
  const scopeEscalation = new ScopeEscalationTracker();
  const checkpoint = new CheckpointStore({ filePath: CHECKPOINT_FILE_PATH });

  const restored = checkpoint.load();
  if (restored) {
    counter.loadState(restored.velocity);
    firstSeenIps.loadState(restored.firstSeenIps);
    impossibleTravel.loadState(restored.impossibleTravel);
    scopeEscalation.loadState(restored.scopeEscalation);
  }

  console.log(
    `Xylem-L6 — Phase 3 demo, adapter: ${adapter.name}, window: ${WINDOW_MS}ms${restored ? " (resumed from checkpoint)" : ""}`,
  );

  for await (const activityEvent of adapter.stream()) {
    const velocity = counter.record(activityEvent.actor.id, activityEvent.timestamp.getTime());
    const breach = velocity >= VELOCITY_BREACH_THRESHOLD ? " [VELOCITY BREACH]" : "";

    const isFirstSeenIp = activityEvent.sourceIp
      ? firstSeenIps.record(activityEvent.actor.id, activityEvent.sourceIp)
      : false;
    const firstSeen = isFirstSeenIp ? ` [FIRST-SEEN IP ${activityEvent.sourceIp}]` : "";

    const travel =
      activityEvent.geo?.lat !== undefined && activityEvent.geo.lon !== undefined
        ? impossibleTravel.record(
            activityEvent.actor.id,
            activityEvent.timestamp.getTime(),
            activityEvent.geo.lat,
            activityEvent.geo.lon,
          )
        : null;
    const impossible = travel?.isImpossible ? ` [IMPOSSIBLE TRAVEL ${Math.round(travel.speedKmh)}km/h]` : "";

    const escalation = scopeEscalation.record(activityEvent.actor.id, activityEvent.scopes);
    const scopeEscalationFlag = escalation.isEscalation
      ? ` [SCOPE ESCALATION ${escalation.newScopes.join(",")}]`
      : "";

    checkpoint.save({
      velocity: counter.getState(),
      firstSeenIps: firstSeenIps.getState(),
      impossibleTravel: impossibleTravel.getState(),
      scopeEscalation: scopeEscalation.getState(),
    });

    console.log(
      `${activityEvent.timestamp.toISOString()} tenant=${activityEvent.tenant ?? "-"} actor=${activityEvent.actor.id} action=${activityEvent.action} velocity=${velocity}${breach}${firstSeen}${impossible}${scopeEscalationFlag}`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
