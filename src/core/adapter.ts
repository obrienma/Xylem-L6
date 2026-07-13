import type { ApiActivityEvent } from "./types.js";

export interface ActivityAdapter {
  readonly name: string;
  stream(): AsyncIterable<ApiActivityEvent>;
}
