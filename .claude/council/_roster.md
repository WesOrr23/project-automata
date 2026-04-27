# Council Roster

Active and archived agents. Updated when agents are added, retired, or change scope.

| Agent | Status | Role | Model | Persistent | Last active |
|---|---|---|---|---|---|
| architecture-reviewer | active | Conformance check against documented design principles | opus | yes | 2026-04-27 (iter-12 close-out) |
| qa-reviewer | active | Test impact analysis; coverage gaps; meaningful-test discipline | opus | yes | 2026-04-27 (iter-11+12 catch-up sweep) |
| typescript-reviewer | active | Type-level correctness; cast discipline; generic constraints | opus | yes | 2026-04-27 (iter-11+12 catch-up sweep) |
| security-reviewer | active | Attack surface analysis (deliberately small for this codebase) | opus | yes | 2026-04-27 (iter-12 sweep — CLEAR) |
| writer | active | Implementation per iteration | opus | **no — ephemeral** | 2026-04-25 (iter-11 stages 1–4 + cleanup) |
| auditor | active | Internal critic of council memory | opus | yes | 2026-04-27 (audit 003) |

## Status meanings

- **active** — operational; can be spawned for tasks
- **sketched** — identity defined, knowledge minimal; not yet ready for production runs
- **archived** — retired; memory preserved in `council-archive/`

## Persistent vs ephemeral

- **Persistent** agents accumulate `knowledge/`, `decisions/`, `open-questions/`, and `journal/` across sessions. The orchestrator loads relevant memory on each spawn.
- **Ephemeral** agents (currently only `writer`) are spawned fresh per iteration with full context handed in. They have no persistent memory. The codebase itself is their memory between iterations.

## Stale flags

The earlier "stale on iter-11" markers (audit-002 P5/P6) for qa-reviewer and typescript-reviewer were resolved on 2026-04-27 by spawning both for a combined iter-11+12 catch-up sweep — see their journal entries `2026-04-27-iter11-iter12-sweep.md`.

The "stale on iter-12" marker on security-reviewer is also resolved as of 2026-04-27 — security-reviewer's `2026-04-27-iter12-sweep.md` verifies the three flagged surfaces (localStorage keys, image-export DOM/data-URL, file-load JSON) clean. Verdict: CLEAR with two low-severity informational items (no input size cap on file load; description text persists to localStorage on shared machines) documented in the attack-surface knowledge.

No reviewers are currently stale.
