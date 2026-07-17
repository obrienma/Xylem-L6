import { describe, expect, it } from "vitest";
import { ApiActivityEventSchema } from "../../src/core/types.js";

const validEvent = {
  id: "evt_1",
  timestamp: new Date().toISOString(),
  actor: { id: "user_1", type: "user" },
  action: "repo.push",
  resource: "repo:obrienma/xylem-l6",
  outcome: "success",
  scopes: [],
  provider: "fixture-replay",
};

describe("ApiActivityEventSchema", () => {
  it("accepts a well-formed event", () => {
    expect(ApiActivityEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it("rejects an event missing a required field", () => {
    const { provider, ...invalid } = validEvent;
    expect(ApiActivityEventSchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an unknown provider", () => {
    const invalid = { ...validEvent, provider: "slack" };
    expect(ApiActivityEventSchema.safeParse(invalid).success).toBe(false);
  });

  it("accepts an event with no tenant set", () => {
    expect(ApiActivityEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it("accepts an event with a tenant set", () => {
    const withTenant = { ...validEvent, tenant: "acme-corp" };
    expect(ApiActivityEventSchema.safeParse(withTenant).success).toBe(true);
  });
});
