import { describe, expect, it, vi } from "vitest";
import { GithubEventsLiveAdapter } from "../../src/adapters/github-events-live/index.js";

function fakeResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  } as Response;
}

const sampleGithubEvents = [
  {
    id: "2",
    type: "IssueCommentEvent",
    actor: { login: "amanda" },
    repo: { name: "obrienma/xylem-l6" },
    created_at: "2026-07-13T12:01:00Z",
  },
  {
    id: "1",
    type: "PushEvent",
    actor: { login: "amanda" },
    repo: { name: "obrienma/xylem-l6" },
    created_at: "2026-07-13T12:00:00Z",
  },
];

describe("GithubEventsLiveAdapter", () => {
  it("maps GitHub events to ApiActivityEvent, oldest-first", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(sampleGithubEvents));
    const adapter = new GithubEventsLiveAdapter({ username: "amanda", token: "x", fetchImpl });

    const events = await adapter.pollOnce();

    expect(events.map((e) => e.id)).toEqual(["1", "2"]);
    expect(events[0]).toMatchObject({
      actor: { id: "amanda", type: "user" },
      action: "PushEvent",
      resource: "obrienma/xylem-l6",
      outcome: "success",
      provider: "github-events-live",
    });
  });

  it("dedupes events already seen on a subsequent poll", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(sampleGithubEvents));
    const adapter = new GithubEventsLiveAdapter({ username: "amanda", token: "x", fetchImpl });

    await adapter.pollOnce();
    const second = await adapter.pollOnce();

    expect(second).toEqual([]);
  });

  it("throws on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => fakeResponse(null, false, 403));
    const adapter = new GithubEventsLiveAdapter({ username: "amanda", token: "x", fetchImpl });

    await expect(adapter.pollOnce()).rejects.toThrow(/403/);
  });

  it("never calls the real global fetch", async () => {
    const realFetch = vi.spyOn(globalThis, "fetch");
    const fetchImpl = vi.fn(async () => fakeResponse([]));
    const adapter = new GithubEventsLiveAdapter({ username: "amanda", token: "x", fetchImpl });

    await adapter.pollOnce();

    expect(realFetch).not.toHaveBeenCalled();
    realFetch.mockRestore();
  });
});
