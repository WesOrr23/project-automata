# Council Roster

Active and archived agents. Updated when agents are added, retired, or change scope.

| Agent | Status | Role | Model | Persistent | Last active |
|---|---|---|---|---|---|
| architecture-reviewer | active | Conformance check against documented design principles | opus | yes | 2026-04-25 (iter-11 close-out) |
| qa-reviewer | active | Test impact analysis; coverage gaps; meaningful-test discipline | opus | yes | 2026-04-25 (iter 7→8 historical) — **stale on iter-11** |
| typescript-reviewer | active | Type-level correctness; cast discipline; generic constraints | opus | yes | 2026-04-25 (iter 7→8 historical) — **stale on iter-11** |
| security-reviewer | active | Attack surface analysis (deliberately small for this codebase) | opus | yes | 2026-04-25 (synthetic verification) |
| writer | active | Implementation per iteration | opus | **no — ephemeral** | 2026-04-25 (iter-11 stages 1–4 + cleanup) |
| auditor | active | Internal critic of council memory | opus | yes | 2026-04-25 (audit 002) |

## Status meanings

- **active** — operational; can be spawned for tasks
- **sketched** — identity defined, knowledge minimal; not yet ready for production runs
- **archived** — retired; memory preserved in `council-archive/`

## Persistent vs ephemeral

- **Persistent** agents accumulate `knowledge/`, `decisions/`, `open-questions/`, and `journal/` across sessions. The orchestrator loads relevant memory on each spawn.
- **Ephemeral** agents (currently only `writer`) are spawned fresh per iteration with full context handed in. They have no persistent memory. The codebase itself is their memory between iterations.

## Stale flags

The "stale on iter-11" markers above point at audit-002 finding P5/P6: those agents were not invoked at iter-11 close-out and their knowledge bases hold facts that have moved underneath them. Spawn them for a sweep before relying on their knowledge for live reviews.
