---
agent: auditor
type: audit
audit-number: NNN
date: YYYY-MM-DD
trigger: <iteration-completion|pre-merge|on-demand>
schema-version: 1
---

# Audit NNN

## Scope

<Which agents and date range were audited.>

## Findings

### Cross-agent contradictions

<Where two or more agents hold incompatible positions. Cite specific files.>

### Internal contradictions

<Per-agent: decisions or knowledge that conflict with each other.>

### Stale knowledge

<Files where verified-as-of is older than threshold or contradicted by recent diffs.>

### Confidence-evidence mismatches

<Claims marked high-confidence with thin provenance.>

### Drift from CLAUDE.md

<Agent decisions that contradict the project's primary design doc.>

## Recommended actions

<Per-agent: supersede X, prune Y, re-verify Z. Routed to affected agents by orchestrator.>

## Patterns observed

<Meta-observations across this and previous audits. Optional but valuable over time.>
