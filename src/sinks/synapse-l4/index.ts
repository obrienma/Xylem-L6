import type { ApiActivityEvent } from "../../core/types.js";
import type { FusedScore } from "../../core/fusion.js";

/**
 * Mirrors synapse-l4/src/evaluation/rules.py's ANOMALY_CRITICAL_THRESHOLD /
 * ANOMALY_DEGRADED_THRESHOLD (ADR 0008's Decision). No cross-language import
 * exists between the two repos — see ADR 0008's Consequences for the drift
 * risk this duplication accepts.
 */
const ANOMALY_CRITICAL_THRESHOLD = 0.8;
const ANOMALY_DEGRADED_THRESHOLD = 0.5;

export type SynapseStatus = "nominal" | "degraded" | "critical";

/** Shape of the body POSTed to Synapse-L4's /ingest — mirrors its RawTelemetry model. */
export interface SynapseIngestPayload {
  source_id: string;
  payload: {
    status: SynapseStatus;
    metric_value: number;
    anomaly_score: number;
    domain: "saas";
  };
}

export interface SynapseL4SinkOptions {
  /** Defaults to SYNAPSE_L4_URL, then to Synapse-L4's own README dev-server default. */
  baseUrl?: string;
  /** Injectable for testing — mock at this boundary, never the class internals. */
  fetchImpl?: typeof fetch;
}

export class SynapseIngestError extends Error {
  readonly statusCode: number | undefined;

  constructor(detail: string, statusCode?: number) {
    super(detail);
    this.name = "SynapseIngestError";
    this.statusCode = statusCode;
  }
}

function statusFor(score: number): SynapseStatus {
  if (score >= ANOMALY_CRITICAL_THRESHOLD) return "critical";
  if (score >= ANOMALY_DEGRADED_THRESHOLD) return "degraded";
  return "nominal";
}

/**
 * Pure mapping from Xylem-L6's own types to Synapse-L4's RawTelemetry shape
 * (ADR 0008): source_id is the triggering event's own id, status is derived
 * from score using Synapse-L4's own Judge thresholds, metric_value is the
 * count of signals that fired at all (not a restatement of score), and
 * domain is the constant "saas".
 */
export function buildIngestPayload(event: ApiActivityEvent, fused: FusedScore): SynapseIngestPayload {
  return {
    source_id: event.id,
    payload: {
      status: statusFor(fused.score),
      metric_value: fused.firedCount,
      anomaly_score: fused.score,
      domain: "saas",
    },
  };
}

/**
 * Egress client for Synapse-L4's POST /ingest — the sink counterpart to
 * src/adapters/ (ingress), kept out of src/core/ so fusion.ts and the four
 * trackers stay free of I/O (ADR 0001's Domain Logic Isolation).
 */
export class SynapseL4Sink {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: SynapseL4SinkOptions = {}) {
    this.baseUrl = options.baseUrl ?? process.env.SYNAPSE_L4_URL ?? "http://localhost:8000";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  /**
   * Sends one event's fused score to Synapse-L4. Throws SynapseIngestError
   * on network failure or a non-2xx response — per ADR 0008, callers log and
   * continue rather than retry; this method itself has no retry logic.
   */
  async send(event: ApiActivityEvent, fused: FusedScore): Promise<void> {
    const body = buildIngestPayload(event, fused);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      throw new SynapseIngestError(`Failed to reach Synapse-L4 at ${this.baseUrl}/ingest: ${String(err)}`);
    }

    if (!response.ok) {
      throw new SynapseIngestError(
        `Synapse-L4 /ingest returned ${response.status} ${response.statusText}`,
        response.status,
      );
    }
  }
}
