# CLAUDE.md

Project-specific Claude Code directives for Xylem-L6, instantiated from `~/.claude/CLAUDE.base.md`.

## Project status

**Phase 1 complete** (per [ADR 0001](docs/adr/0001-ingestion-target-stream-processor.md)): canonical `ApiActivityEvent` schema, both adapters (`fixture-replay`, `github-events-live`) working for real, and the in-memory sliding-window velocity counter. No persistence, no external sink — `npm run dev` is the demo. Phase 2 (first-seen sets, impossible travel) has not started.

---

## Commit message format

When suggesting a commit message, use this format:

```
<type>(<scope>): <subject>
(<Phase or step tag, if applicable>)

<body wrapped at ~72 characters>
```

The phase/step tag goes on its own line immediately after the subject, before the blank line that precedes the body. For this project, the phase tag should reference the ADR 0001 phase (e.g. `(Phase 1)`).

**Documentation audits** — when the work is a documentation consistency/accuracy audit (reconciling docs against code, adding/correcting docs as a sweep rather than a build phase), use the type+scope `docs(audit)`.

---

## Workflow

- **Work one step at a time** and pause for confirmation before moving to the next build step.
- **Commit after each logical step** — the user commits manually; don't push. Always provide a suggested commit message.
- **Don't add features beyond what's asked.** No extra error handling, no extra abstractions, no unrequested refactors.
- **After every completed step: update `README.md` and follow the journal-anki skill** — this is mandatory, not optional.
  - `README.md`: add a new checked item to the Status/Roadmap section, add any new forward work to "Deliberately Deferred" or the phase checklist, and correct any stale architecture descriptions (especially the pipeline diagram once adapters exist).
  - Journal: before suggesting a commit message, follow `~/.claude/skills/journal-anki.md` to write a journal entry (see "Journal (journal-anki)" below).

---

## Journal (journal-anki)

At the end of any development phase, before proposing a commit or when the user requests a commit message, follow the journal-anki skill at `~/.claude/skills/journal-anki.md` to write a journal entry — typed **Pattern** / **Anti-Pattern** / **Challenge** / **Decision** sections, plus paired Anki probe cards. **Challenges are mandatory in every entry**: even if none occurred, state that explicitly rather than omitting the section. Retroactively add a challenge to a prior entry if later work reveals a gotcha that existed then.

**During the session:** note decisions where a reasonable alternative existed. These are the hardest to reconstruct after the fact. When a fork-in-the-road moment occurs — a design choice, a rejected approach, a tradeoff accepted — record it immediately as a candidate Decision entry rather than trying to reconstruct it when writing the journal.

---

## Testing

- **Never hit real external APIs in tests** — this applies specifically to the `github-events-live` adapter; mock at the adapter-interface boundary (the shared contract both adapters implement), not inside individual adapter internals. `fixture-replay` exists precisely so windowing/signal logic can be tested without live calls at all.
- **Test runner: Vitest.** Run the full suite with `npm test` (or `npm run test:watch` while iterating). Tests live in `tests/`, mirroring `src/` by module (e.g. `tests/core/types.test.ts` covers `src/core/types.ts`).
- **Architecture/domain-isolation test:** `tests/arch.test.ts` — asserts no file under `src/core/` imports from `src/adapters/`. Run it after any change under `src/core/`.
- Do not test implementation details — test behaviour and output (e.g. "given this event sequence, this signal fires," not internal window bookkeeping).
- Use dataset-driven tests where the input space is non-trivial (signal thresholds, boundary/late-event windowing cases are a natural fit for `fixture-replay`).

---

## Domain Logic Isolation

The signal-computation core (`src/core/window.ts`'s sliding-window velocity counter today; Phase 2 will add first-seen/impossible-travel/scope-escalation signals alongside it) must not import adapter-specific HTTP clients or SDKs directly. All adapter I/O must go through the shared `ActivityAdapter` interface (`src/core/adapter.ts`), implemented by `src/adapters/fixture-replay/` and `src/adapters/github-events-live/`, both producing the canonical `ApiActivityEvent` contract (`src/core/types.ts`). Enforced by `tests/arch.test.ts` (equivalent in spirit to sentinel-l7's Pest arch tests).

---

## Prompts Convention

Not applicable. Xylem-L6 has no LLM/AI step — see [ADR 0003](docs/adr/0003-gcp-deployment-target.md) ("Vertex AI is not used — Xylem-L6 has no LLM step; that stays Sentinel-L7's domain entirely").

---

## doc files
- Use the write-docs skill.
- ADRs live in `docs/adr/`, numbered `NNNN-slug.md` (see `0001`–`0003`).

---

## TypeScript

- Strict mode means all nullable paths must be handled — don't use `!` non-null assertions unless provably safe.
- ESM (`"type": "module"`) — all imports need explicit `.js` extensions when importing local files (TypeScript resolves `.ts` → `.js` at runtime with NodeNext).
- Runtime schema validation via **Zod** for `ApiActivityEvent` and provider-adapter inputs (per ADR 0001) — this is the project's equivalent of the suite-wide "runtime schema validation is a discipline, not a language feature" pattern (Pydantic/Instructor elsewhere in Rhizome Risk).
