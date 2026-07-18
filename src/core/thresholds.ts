/**
 * Shared thresholds for both the demo's console bracket flags (index.ts)
 * and fusion severity normalization (fusion.ts) — one source of truth per
 * ADR 0005's Rationale, rather than two numbers drifting independently.
 */
export const VELOCITY_BREACH_THRESHOLD = 3;
export const MAX_PLAUSIBLE_SPEED_KMH = 900; // roughly a commercial jet's cruising speed
