const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two lat/lon points, in kilometers. */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export interface ImpossibleTravelResult {
  distanceKm: number;
  speedKmh: number;
  isImpossible: boolean;
}

export interface ImpossibleTravelDetectorOptions {
  /** Speeds above this are treated as physically implausible for ordinary travel. */
  maxPlausibleSpeedKmh: number;
}

/**
 * Tracks, per actor, the most recent geo-tagged event. Running state, like
 * FirstSeenIpTracker — not a window: only the single most recent point
 * matters, not a history of them.
 */
export interface ImpossibleTravelDetectorState {
  lastByActor: [string, { atMs: number; lat: number; lon: number }][];
}

export class ImpossibleTravelDetector {
  private readonly maxPlausibleSpeedKmh: number;
  private readonly lastByActor = new Map<string, { atMs: number; lat: number; lon: number }>();

  constructor(options: ImpossibleTravelDetectorOptions) {
    this.maxPlausibleSpeedKmh = options.maxPlausibleSpeedKmh;
  }

  /** Returns null if this is the actor's first geo-tagged event (no baseline to compare against). */
  record(actorId: string, atMs: number, lat: number, lon: number): ImpossibleTravelResult | null {
    const previous = this.lastByActor.get(actorId);
    this.lastByActor.set(actorId, { atMs, lat, lon });

    if (!previous) return null;

    const distanceKm = haversineDistanceKm(previous.lat, previous.lon, lat, lon);
    const hours = Math.abs(atMs - previous.atMs) / 3_600_000;
    const speedKmh = hours === 0 ? Infinity : distanceKm / hours;

    return { distanceKm, speedKmh, isImpossible: speedKmh > this.maxPlausibleSpeedKmh };
  }

  getState(): ImpossibleTravelDetectorState {
    return { lastByActor: [...this.lastByActor.entries()] };
  }

  loadState(state: ImpossibleTravelDetectorState): void {
    this.lastByActor.clear();
    for (const [actorId, point] of state.lastByActor) {
      this.lastByActor.set(actorId, point);
    }
  }
}
