export interface ScopeEscalationResult {
  /** Scopes on this event not previously seen for this actor. */
  newScopes: string[];
  /** True when newScopes is non-empty AND the actor already had a scope baseline — the actor's very first event establishes the baseline, it doesn't escalate from one. */
  isEscalation: boolean;
}

/**
 * Tracks, per actor, the set of scopes/permissions ever exercised. Running
 * state with the same "seen-set, flag on first occurrence" shape as
 * FirstSeenIpTracker (see ADR 0001 addendum) — not the window-only counting
 * SlidingWindowVelocityCounter does.
 */
export interface ScopeEscalationTrackerState {
  seenScopesByActor: [string, string[]][];
}

export class ScopeEscalationTracker {
  private readonly seenScopesByActor = new Map<string, Set<string>>();

  record(actorId: string, scopes: string[]): ScopeEscalationResult {
    const seen = this.seenScopesByActor.get(actorId);
    const hadBaseline = seen !== undefined && seen.size > 0;
    const scopeSet = seen ?? new Set<string>();

    const newScopes = scopes.filter((scope) => !scopeSet.has(scope));
    for (const scope of scopes) {
      scopeSet.add(scope);
    }
    this.seenScopesByActor.set(actorId, scopeSet);

    return { newScopes, isEscalation: hadBaseline && newScopes.length > 0 };
  }

  getState(): ScopeEscalationTrackerState {
    return {
      seenScopesByActor: [...this.seenScopesByActor.entries()].map(([actorId, scopes]) => [actorId, [...scopes]]),
    };
  }

  loadState(state: ScopeEscalationTrackerState): void {
    this.seenScopesByActor.clear();
    for (const [actorId, scopes] of state.seenScopesByActor) {
      this.seenScopesByActor.set(actorId, new Set(scopes));
    }
  }
}
