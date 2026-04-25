# Council Memory Conventions

This document is the spec for how council memory is structured. Every memory file must conform to it. The auditor checks adherence.

## Schema version

Current version: `1`

Every file has `schema-version: 1` in frontmatter. Migrations are written when this number changes; old files keep working until migrated.

## File types

Six types, each with a template in `_schema/`:

- **identity** — who an agent is. One per agent. Stable, rarely changes.
- **knowledge** — what an agent knows. Mutable; can be rewritten.
- **decision** — a position an agent has taken. Append-mostly; superseded rather than overwritten.
- **open-question** — an unresolved concern. Either resolves (deleted or marked resolved) or hardens into a decision.
- **journal** — what happened in an interaction. Append-only. Never edited.
- **audit** — auditor's findings. Lives only under `auditor/journal/audits/`. Append-only.

## Frontmatter

Every file starts with YAML frontmatter. Required fields vary by type but always include:

- `agent` — slug of the owning agent (e.g., `architecture-reviewer`)
- `type` — one of: `identity`, `knowledge`, `decision`, `open-question`, `journal`, `audit`, `index`
- `schema-version` — integer

Type-specific required fields are documented in each template under `_schema/`.

## File organization per agent

```
<agent-slug>/
  identity.md
  knowledge/
    _index.md
    <topic>.md
  decisions/
    _index.md
    <decision-id>.md
  open-questions/
    _index.md
    <question-id>.md
  journal/
    YYYY-MM-DD-<context>.md
```

## File naming

- Knowledge files: `<topic-slug>.md` (kebab-case, descriptive)
- Decision files: `<decision-slug>.md` (kebab-case, declarative — e.g., `result-types-use-typed-errors.md`)
- Open-question files: `<question-slug>.md`
- Journal files: `YYYY-MM-DD-<context>.md` (e.g., `2026-04-25-iter-1-result-types.md`)
- Audit files: `YYYY-MM-DD-audit-NNN.md` (NNN zero-padded sequence)

## Indexes

Each subdirectory (`knowledge/`, `decisions/`, `open-questions/`) has an `_index.md` listing its contents. Indexes are **derived, not authoritative** — they can be regenerated from directory contents. If an index drifts from reality, regenerate it; don't treat it as truth.

Index entry format:

```markdown
- [<title>](<filename>) — <one-line summary>
```

## Verification tags

Knowledge files include `verified-as-of: <commit-hash>` indicating the codebase commit they were last validated against. The auditor flags knowledge files where `verified-as-of` is older than a threshold relative to recent diffs.

## Confidence levels

Knowledge files include `confidence: <high|medium|low>`. Low-confidence claims are subject to extra scrutiny in audits.

## Supersedes chain

Decisions are append-mostly. To change a decision:

1. Create a new decision file.
2. Set `supersedes: <old-decision-id>` in the new file's frontmatter.
3. Set `status: superseded` and `superseded-by: <new-decision-id>` in the old file.
4. Do not delete the old file.

This preserves the reasoning trail and lets the auditor detect circular supersedes (a smell).

## Append-only rules

Journal and audit files are append-only. Never edit them. If a journal entry is wrong, write a correction note in the next entry — don't rewrite history.

## Mutable rules

Knowledge files are mutable. To update:

1. Update the content.
2. Update `last-updated` and `verified-as-of` in frontmatter.
3. Note the change in the next journal entry (so provenance survives).

## Citation discipline

Knowledge files should cite by **symbol name + file**, not by line number. Line numbers drift even after a single iteration (audit-001 found stale line citations after one round of merges). Acceptable forms:

- "the `as unknown as T` cast inside `computePreview`'s symbol-modify branch" — symbol-relative, survives refactors.
- "`hasStartState` in `src/engine/validator.ts`" — symbol-relative.
- Bad: "lines 415, 494, 548 of `creationReducer.ts`" — drifts the moment the file grows.

Line numbers are acceptable in:

- **Audit and journal entries** that explicitly snapshot a commit (`verified-as-of` field documents the reference point).
- **Side-channel commentary** ("verified at line 437 of HEAD") where the citation is point-in-time and not load-bearing for future reasoning.

When in doubt: use symbol names. If you must use a line number in knowledge, treat it as a hint, and ensure the symbol-name reference is also present so a future reader can re-locate the code.

## Closing the journal-to-knowledge correction loop

If a journal entry contains a queued correction (e.g., "this should propagate to knowledge X"), the orchestrator MUST apply that correction to the knowledge file before the next spawn of the affected agent. Audit-001 finding #4 (the qa-reviewer `startState` correction never reaching knowledge) is the canonical failure mode — a correction visible to the auditor but invisible to the agent on its next read. The mechanical fix is: when applying memory updates after an agent run, scan for "knowledge update queued" or "should propagate" markers and resolve them in the same commit.

## Quarantine

The orchestrator validates frontmatter on agent spawn. Files with malformed or missing frontmatter are moved to `<agent>/_quarantine/` and a journal entry is written. They do not poison context.
