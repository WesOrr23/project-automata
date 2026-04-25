---
agent: architecture-reviewer
type: open-question
id: claude-md-drift
schema-version: 1
date-raised: 2026-04-25
status: open
resolved-date: null
resolution: null
---

# CLAUDE.md drift from current code reality

## Question

CLAUDE.md is the project's primary design doc and is cited as provenance in multiple architecture-reviewer knowledge files. The auditor (audit-001) found three drifts between CLAUDE.md and the current codebase:

1. CLAUDE.md "Validation Strategy" lists `hasOrphanedStates()`. Actual symbol is `getOrphanedStates` (in `src/engine/validator.ts`).
2. CLAUDE.md headers iter 3 as "(PLANNED)" despite iter 3 (and 4–10) being complete and merged.
3. CLAUDE.md's "Future Iterations (Backlog)" section lists "Iteration 6: NFA Support" as future, despite NFA support shipping in iter 8.

Does the project owner want to update CLAUDE.md, or should the council shift its provenance strategy (e.g., cite the code directly rather than the doc)?

## Why it matters

Multiple architecture-reviewer knowledge files (`engine-ui-separation.md`, `state-id-management.md`, `type-system-conventions.md`) cite CLAUDE.md as provenance. If CLAUDE.md is a moving target whose drifts go uncorrected, those provenance citations are inheriting silent staleness — even though the underlying *facts* (engine/UI separation, immutability, etc.) remain true at the code level.

## What's known so far

- The drift is concrete and verifiable.
- No single agent's review has flagged it; auditor caught it cross-referencing.
- The architectural principles cited from CLAUDE.md (separation, immutability, ID management) all still hold in the code, so the practical impact is limited. The doc's iteration-status section is the part most stale.

## What would resolve it

Defer to the project owner. Two paths:

- **Update CLAUDE.md** to reflect current state (mark iter 1–10 complete, fix `hasOrphanedStates`/`getOrphanedStates`, refresh the iteration backlog with current priorities).
- **Shift provenance strategy** in council knowledge files to cite the code directly when possible, treating CLAUDE.md as advisory rather than authoritative.

The first is cheaper if Wes is willing to maintain the doc; the second is more robust if he prefers to let the doc lag.
