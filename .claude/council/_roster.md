# Council Roster

Active and archived agents. Updated when agents are added, retired, or change scope.

| Agent | Status | Role | Model | Last active |
|---|---|---|---|---|
| architecture-reviewer | active | Conformance check against documented design principles | opus | 2026-04-25 (synthetic verification) |
| auditor | sketched | Internal critic of council memory | opus | (never) |

## Status meanings

- **active** — operational; can be spawned for tasks
- **sketched** — identity defined, knowledge minimal; not yet ready for production runs
- **archived** — retired; memory preserved in `council-archive/`

## Phase 2 (planned)

| Agent | Role |
|---|---|
| qa-reviewer | Test impact analysis; coverage gaps; flaky-test patterns |
| typescript-reviewer | Type-level correctness at callsites; unsafe casts; inference gaps |
| security-reviewer | Attack surface analysis (low-priority for this codebase but reserved) |
| writer | Implementer; ephemeral — fresh context per iteration, no persistent memory |
