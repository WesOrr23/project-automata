# The Council

A persistent agent memory system for code review and design oversight.

## What this is

A council of long-lived specialist agents that retain memory across sessions. Each agent has a role (architecture, security, QA, etc.) and accumulates knowledge, decisions, and open questions about the codebase as it reviews diffs over time.

The orchestrator (Claude Code) spawns council agents on demand, loads their relevant memory into the prompt, runs them on a task, and persists their memory updates back to disk. Over time, agents become genuine specialists rather than every-call-cold reviewers.

## Why

Cold reviewers waste tokens re-reading the codebase every invocation. Persistent reviewers amortize that cost — read once, accumulate forever. They also become consistent: the same agent that approved a pattern in iteration 1 will recognize it in iteration 5 and judge accordingly. The risk is that they reinforce their own past judgments without re-examining them — that's what the auditor exists to catch.

## Roles

See `_roster.md` for the active list. Initial roles:

- **architecture-reviewer** — checks diffs against documented design principles
- **auditor** — reads the other agents' memory looking for drift, contradictions, stale knowledge

Phase 2 will add:
- **qa-reviewer** — test impact analysis
- **typescript-reviewer** — type-level correctness
- **security-reviewer** — attack surface analysis (if/when relevant)
- **writer** — implementer; ephemeral, not persistent

## How it works

### Spawn lifecycle

1. Orchestrator decides to invoke `<agent>`.
2. Orchestrator loads `<agent>/identity.md`, `<agent>/*/_index.md`, and any task-relevant detail files into the agent's prompt.
3. Orchestrator injects the task (e.g., a diff to review).
4. Agent runs, produces a verdict and proposed memory updates.
5. Orchestrator validates memory updates (frontmatter, schema), commits them.
6. Orchestrator writes a journal entry capturing the interaction.

### Memory updates

Agents propose memory updates as part of their output; the orchestrator applies them. Agents do not write directly to disk — every change passes through the orchestrator for validation. This prevents corrupted memories from poisoning future runs.

### Cross-iteration persistence

Across iterations, agents retain everything in their memory directory. Indexes summarize; detail files load on demand. The cost of spawning an established agent is roughly: identity (~50 lines) + indexes (~30 lines each) + relevant detail files (~200 lines avg) = under 500 lines of context overhead, vs. ~10,000+ for a cold codebase read.

## Adding a new agent

1. Pick a slug (kebab-case, descriptive).
2. Create the directory structure (see `_conventions.md`).
3. Write `identity.md` from `_schema/identity.template.md`.
4. Add the agent to `_roster.md`.
5. Initial knowledge files can be drafted from existing project docs (`CLAUDE.md`, etc.) — note the provenance.

## Auditing

The auditor runs periodically (every N iterations, before major merges, or on demand). It produces a report identifying drift, contradictions, stale knowledge, and confidence-evidence mismatches. Findings route to affected agents, who can defend, supersede, or fix.

The auditor cannot modify other agents' memory directly. All changes pass through the orchestrator, which routes audit findings appropriately.

## Conventions

See `_conventions.md` for the memory format specification.
