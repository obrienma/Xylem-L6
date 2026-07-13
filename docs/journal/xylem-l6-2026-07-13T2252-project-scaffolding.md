---
id: xylem-l6-2026-07-13T2252-project-scaffolding
repo: xylem-l6
title: "Project Scaffolding (TypeScript + Zod + Vitest)"
date: 2026-07-13
phase: 0
tags: [typescript, zod, vitest, ports-and-adapters, hexagonal-architecture, schema-validation, esm, nodenext]
files: [package.json, tsconfig.json, .gitignore, src/core/types.ts, src/core/adapter.ts, src/adapters/fixture-replay/index.ts, src/adapters/github-events-live/index.ts, src/index.ts, tests/core/types.test.ts, README.md, CLAUDE.md]
---

### Pattern: Ports and Adapters (Hexagonal Architecture)

The `ActivityAdapter` interface (`src/core/adapter.ts`) is the port; `FixtureReplayAdapter` and `GithubEventsLiveAdapter` are the two adapters implementing it, each producing the canonical `ApiActivityEvent` contract. Neither adapter is imported by name anywhere outside its own directory yet — the not-yet-built signal-computation core is meant to depend only on the port, never on a specific adapter's internals. This is the same shape ADR 0001 already committed to conceptually; this phase is where it became an actual TypeScript interface with two implementing classes instead of prose.

### Pattern: Schema-First Validation at the System Boundary

`ApiActivityEventSchema` (Zod) is the single point where an event is accepted or rejected, for both adapters. Both stub adapters currently throw before producing any events, so the schema isn't exercised end-to-end yet — but its shape (actor, action, resource, source IP, geo, outcome, scopes, provider) is fixed now, matching ADR 0001's Decision section, so Phase 1's adapter implementations have a contract to fill rather than a decision to make.

### Challenge: tsc rootDir Conflict with Test Directory

**Symptom:** `npx tsc --noEmit -p tsconfig.json` failed with `TS6059: File '.../tests/core/types.test.ts' is not under 'rootDir' '.../src'`.

**Root cause:** `tsconfig.json` pinned `"rootDir": "src"` while `"include"` also pulled in `tests/**/*.ts`. `rootDir` constrains where TypeScript expects *all* included files to live, not just emitted output — it doesn't tolerate `include` reaching outside it, even for files that are never meant to be emitted to `dist/`. Vitest didn't surface this at all, since it type-checks via esbuild and ignores `rootDir`, so `npm test` passed while `tsc --noEmit` failed — a case where the two tools' notion of "the project compiles" silently diverged.

**Fix:** Dropped the explicit `rootDir` line and let TypeScript infer it as the common ancestor of every included file (project root, since `src/` and `tests/` are siblings). `dist/` now mirrors `src/...` and `tests/...` under it, which is harmless since `dist/` is gitignored and nothing publishes from it.

### Decision: Vitest + tsx + npm, Not Jest/ts-node/pnpm

Chose Vitest (ESM-native, fast, no transform-config wrestling under `"type": "module"` + NodeNext the way Jest historically requires) and `tsx` for running TypeScript directly in dev without a separate build step. npm was used over pnpm/yarn simply because neither alternative package manager was installed in this environment and ADR 0001/0003 don't specify one — nothing here is meant to be a durable commitment the way the ADRs are; it's a reversible tooling choice, not architecture.

### Decision: Scaffolding Scope Boundary

Deliberately stopped at skeleton + stubs + one smoke test, not Phase 1 itself. Both adapters throw `not implemented`; no sliding-window velocity counter exists. Confirmed after the fact (Pass 2 retrospective) that this was the right boundary — scaffolding proves the toolchain works end-to-end (`npm install`, `tsc --noEmit`, `vitest run`, `tsx src/index.ts` all green) without pre-empting Phase 1's actual implementation decisions.
