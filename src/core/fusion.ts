import type { ImpossibleTravelResult } from "./impossibleTravel.js";
import type { ScopeEscalationResult } from "./scopeEscalation.js";
import { VELOCITY_BREACH_THRESHOLD, MAX_PLAUSIBLE_SPEED_KMH } from "./thresholds.js";

export type FusionSignal = "velocity" | "firstSeenIp" | "impossibleTravel" | "scopeEscalation";

export interface FusionInput {
  velocity: number;
  isFirstSeenIp: boolean;
  /** Null when the event carries no geo data or is the actor's first geo-tagged event. */
  impossibleTravel: ImpossibleTravelResult | null;
  scopeEscalation: ScopeEscalationResult;
}

export interface FusedScore {
  /** Max of the four normalized severities, in [0, 1]. */
  score: number;
  /** Which signal(s) produced `score` — may be more than one on a tie. */
  signals: FusionSignal[];
}

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Max-of-signals fusion (ADR 0005): each signal is normalized independently
 * to a severity in [0, 1] — boolean signals fire at 1.0 or 0, continuous
 * signals scale by the same thresholds index.ts uses for its console bracket
 * flags — and the event's score is the maximum of the four. Pure function,
 * no I/O, no tracker state of its own.
 */
export function fuseSignals(input: FusionInput): FusedScore {
  const severities: Record<FusionSignal, number> = {
    velocity: clamp01(input.velocity / VELOCITY_BREACH_THRESHOLD),
    firstSeenIp: input.isFirstSeenIp ? 1 : 0,
    impossibleTravel: input.impossibleTravel
      ? clamp01(input.impossibleTravel.speedKmh / MAX_PLAUSIBLE_SPEED_KMH)
      : 0,
    scopeEscalation: input.scopeEscalation.isEscalation ? 1 : 0,
  };

  const score = Math.max(...Object.values(severities));
  const signals = (Object.keys(severities) as FusionSignal[]).filter(
    (signal) => score > 0 && severities[signal] === score,
  );

  return { score, signals };
}
