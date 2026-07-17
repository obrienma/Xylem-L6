import { z } from "zod";

export const ApiActivityEventSchema = z.object({
  id: z.string(),
  timestamp: z.coerce.date(),
  actor: z.object({
    id: z.string(),
    type: z.enum(["user", "service_account", "unknown"]),
  }),
  action: z.string(),
  resource: z.string(),
  sourceIp: z.string().optional(),
  geo: z
    .object({
      country: z.string().optional(),
      lat: z.number().optional(),
      lon: z.number().optional(),
    })
    .optional(),
  outcome: z.enum(["success", "failure"]),
  scopes: z.array(z.string()).default([]),
  provider: z.enum(["fixture-replay", "github-events-live", "okta"]),
  tenant: z.string().optional(),
});

export type ApiActivityEvent = z.infer<typeof ApiActivityEventSchema>;
