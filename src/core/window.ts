export interface SlidingWindowVelocityCounterOptions {
  windowMs: number;
}

export interface SlidingWindowVelocityCounterState {
  timestampsByActor: [string, number[]][];
  watermarkByActor: [string, number][];
}

/**
 * Windowing is driven by event time (the `atMs` passed per call), not
 * wall-clock processing time, so a late-arriving event is placed relative to
 * when it happened, not when it was processed. Per actor, a watermark (the
 * highest event time seen so far) governs retention.
 *
 * Retention keeps entries within `2 * windowMs` of the watermark, not just
 * `windowMs`: a late event can itself arrive with an `atMs` up to one
 * `windowMs` behind the watermark (Phase 1's fixed "allowed lateness"), and
 * that event's own trailing window then reaches a further `windowMs` back
 * from there. Retaining only `windowMs` of history would silently undercount
 * exactly the late/out-of-order case fixture-replay exists to exercise. An
 * event whose lateness exceeds one `windowMs` is outside this bound and may
 * be undercounted — a real "allowed lateness" config is a Phase 2+ concern,
 * not solved here.
 *
 * The count returned by a given call is always the window ending at that
 * call's own `atMs`, not the watermark.
 */
export class SlidingWindowVelocityCounter {
  private readonly windowMs: number;
  private readonly timestampsByActor = new Map<string, number[]>();
  private readonly watermarkByActor = new Map<string, number>();

  constructor(options: SlidingWindowVelocityCounterOptions) {
    this.windowMs = options.windowMs;
  }

  record(actorId: string, atMs: number): number {
    const timestamps = this.timestampsByActor.get(actorId) ?? [];
    timestamps.push(atMs);

    const watermark = Math.max(this.watermarkByActor.get(actorId) ?? atMs, atMs);
    this.watermarkByActor.set(actorId, watermark);

    const retained = timestamps.filter((t) => t >= watermark - 2 * this.windowMs);
    this.timestampsByActor.set(actorId, retained);

    return this.windowCount(retained, atMs);
  }

  count(actorId: string, atMs: number): number {
    const timestamps = this.timestampsByActor.get(actorId) ?? [];
    return this.windowCount(timestamps, atMs);
  }

  private windowCount(timestamps: number[], atMs: number): number {
    const cutoff = atMs - this.windowMs;
    return timestamps.filter((t) => t >= cutoff && t <= atMs).length;
  }

  getState(): SlidingWindowVelocityCounterState {
    return {
      timestampsByActor: [...this.timestampsByActor.entries()],
      watermarkByActor: [...this.watermarkByActor.entries()],
    };
  }

  loadState(state: SlidingWindowVelocityCounterState): void {
    this.timestampsByActor.clear();
    for (const [actorId, timestamps] of state.timestampsByActor) {
      this.timestampsByActor.set(actorId, timestamps);
    }
    this.watermarkByActor.clear();
    for (const [actorId, watermark] of state.watermarkByActor) {
      this.watermarkByActor.set(actorId, watermark);
    }
  }
}
