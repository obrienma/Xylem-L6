import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CORE_DIR = join(import.meta.dirname, "..", "src", "core");

function listTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listTsFiles(path) : entry.name.endsWith(".ts") ? [path] : [];
  });
}

describe("domain isolation", () => {
  it("src/core never imports from src/adapters", () => {
    const offenders = listTsFiles(CORE_DIR).filter((file) => /from\s+["'].*adapters/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
