---
agent: architecture-reviewer
type: open-question
id: automaton-like-pending-user-review
schema-version: 1
date-raised: 2026-04-25
status: open
resolved-date: null
resolution: null
---

# AutomatonLike — gated on Wes's review

## Question

The architecture-reviewer holds two contradictory positions on `AutomatonLike<T extends TransitionLike>`:

- `knowledge/engine-ui-separation.md` describes it as "one known crack" with `as unknown as T` casts.
- `journal/2026-04-25-historical-iter7-iter8-review.md` softens this to "borderline-acceptable, not premature abstraction."

The typescript-reviewer disagrees with the architect's softer journal verdict and reinforced their `generic-constraints.md` cautionary-tale verdict instead.

The auditor (audit-001 finding #1, #3) flagged this as both a cross-agent contradiction and an internal contradiction within the architect's own memory.

**Wes has explicitly said he wants to review `AutomatonLike` and similar structures personally before any change lands.** Until that happens, the contradictions should NOT be reconciled.

## Why it matters

This is the only contradiction in council memory that is deliberately preserved rather than fixed. It exists because the resolution depends on a project-owner decision that the council cannot make.

## What's known so far

- typescript-reviewer's evidence: cast was present at the introducing commit (`1493832`), 2 internal casts at HEAD plus one caller-side cast in `App.tsx`, single concrete caller in the entire codebase, no second instantiation planned.
- architect's softer reading: localized abstraction with a concrete caller, layering aesthetic motivation.
- Code reality at HEAD (verified by auditor): 2 internal casts, 1 caller cast, 1 caller total.

## What would resolve it

Wes reviews the structure and decides. Likely paths:

- **Approve the proposed fix** (move `computePreview` to `engine/preview.ts`, kill the generic, delete all three casts). Architect's knowledge stays as-is; journal verdict is withdrawn or aligned.
- **Defer the fix** (decide the abstraction is fine for now). Architect's journal verdict becomes the new knowledge baseline; typescript-reviewer's cautionary-tale entry is downgraded or contextualized.
- **Different approach** Wes designs after understanding the structure.

Until then: do not edit the architect's `engine-ui-separation.md` to match the journal, and do not edit the journal to match the knowledge file. Preserve the disagreement.
