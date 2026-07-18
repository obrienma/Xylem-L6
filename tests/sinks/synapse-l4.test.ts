import { describe, expect, it, vi } from "vitest";
import { buildIngestPayload, SynapseIngestError, SynapseL4Sink } from "../../src/sinks/synapse-l4/index.js";
import type { ApiActivityEvent } from "../../src/core/types.js";
import type { FusedScore } from "../../src/core/fusion.js";

function fakeResponse(ok = true, status = 200): Response {
  return { ok, status, statusText: ok ? "OK" : "Error" } as Response;
}

const sampleEvent: ApiActivityEvent = {
  id: "evt-42",
  timestamp: new Date("2026-07-17T12:00:00Z"),
  actor: { id: "amanda", type: "user" },
  action: "repo.push",
  resource: "repo:obrienma/xylem-l6",
  outcome: "success",
  scopes: [],
  provider: "fixture-replay",
};

function fused(overrides: Partial<FusedScore>): FusedScore {
  return { score: 0, signals: [], firedCount: 0, ...overrides };
}

describe("buildIngestPayload", () => {
  it.each<{ name: string; score: number; status: "nominal" | "degraded" | "critical" }>([
    { name: "below the degraded threshold", score: 0.49, status: "nominal" },
    { name: "at the degraded threshold", score: 0.5, status: "degraded" },
    { name: "between degraded and critical", score: 0.79, status: "degraded" },
    { name: "at the critical threshold", score: 0.8, status: "critical" },
    { name: "above the critical threshold", score: 1, status: "critical" },
  ])("maps score $name to status=$status (Synapse-L4's own Judge thresholds)", ({ score, status }) => {
    const payload = buildIngestPayload(sampleEvent, fused({ score }));
    expect(payload.payload.status).toBe(status);
  });

  it("uses the event's own id as source_id, not a generated one", () => {
    const payload = buildIngestPayload(sampleEvent, fused({}));
    expect(payload.source_id).toBe("evt-42");
  });

  it("uses firedCount as metric_value, not score restated", () => {
    const payload = buildIngestPayload(sampleEvent, fused({ score: 1, firedCount: 3 }));
    expect(payload.payload.metric_value).toBe(3);
    expect(payload.payload.metric_value).not.toBe(payload.payload.anomaly_score);
  });

  it("sets anomaly_score to the fused score directly", () => {
    const payload = buildIngestPayload(sampleEvent, fused({ score: 0.42 }));
    expect(payload.payload.anomaly_score).toBe(0.42);
  });

  it("always tags domain as the constant 'saas'", () => {
    const payload = buildIngestPayload(sampleEvent, fused({}));
    expect(payload.payload.domain).toBe("saas");
  });
});

describe("SynapseL4Sink", () => {
  it("POSTs the built payload as JSON to {baseUrl}/ingest", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse());
    const sink = new SynapseL4Sink({ baseUrl: "http://example.test", fetchImpl });

    await sink.send(sampleEvent, fused({ score: 1, firedCount: 2 }));

    expect(fetchImpl).toHaveBeenCalledWith(
      "http://example.test/ingest",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildIngestPayload(sampleEvent, fused({ score: 1, firedCount: 2 }))),
      }),
    );
  });

  it("defaults baseUrl to http://localhost:8000, matching synapse-l4's README dev-server instructions", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse());
    const sink = new SynapseL4Sink({ fetchImpl });

    await sink.send(sampleEvent, fused({}));

    expect(fetchImpl).toHaveBeenCalledWith("http://localhost:8000/ingest", expect.anything());
  });

  it("throws SynapseIngestError on a non-2xx response", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(false, 422));
    const sink = new SynapseL4Sink({ fetchImpl });

    await expect(sink.send(sampleEvent, fused({}))).rejects.toThrow(SynapseIngestError);
    await expect(sink.send(sampleEvent, fused({}))).rejects.toThrow(/422/);
  });

  it("throws SynapseIngestError when the network call itself fails", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const sink = new SynapseL4Sink({ fetchImpl });

    await expect(sink.send(sampleEvent, fused({}))).rejects.toThrow(SynapseIngestError);
  });

  it("never calls the real global fetch", async () => {
    const realFetch = vi.spyOn(globalThis, "fetch");
    const fetchImpl = vi.fn(async () => fakeResponse());
    const sink = new SynapseL4Sink({ fetchImpl });

    await sink.send(sampleEvent, fused({}));

    expect(realFetch).not.toHaveBeenCalled();
    realFetch.mockRestore();
  });
});
