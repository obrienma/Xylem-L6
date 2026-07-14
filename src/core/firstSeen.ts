/**
 * Tracks, per actor, the set of source IPs seen so far. Unlike the
 * window-only velocity counter, this is running state with no eviction —
 * a "seen" entry is permanent for the lifetime of the process (Phase 3's
 * checkpointing concern is what makes that state durable across restarts,
 * not addressed here).
 */
export class FirstSeenIpTracker {
  private readonly seenIpsByActor = new Map<string, Set<string>>();

  /** Returns true if this is the first time this actor has been seen from sourceIp. */
  record(actorId: string, sourceIp: string): boolean {
    const seen = this.seenIpsByActor.get(actorId) ?? new Set<string>();
    const isFirstSeen = !seen.has(sourceIp);
    seen.add(sourceIp);
    this.seenIpsByActor.set(actorId, seen);
    return isFirstSeen;
  }
}
