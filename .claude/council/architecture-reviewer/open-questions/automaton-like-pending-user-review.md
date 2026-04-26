---
agent: architecture-reviewer
type: open-question
id: automaton-like-pending-user-review
schema-version: 1
date-raised: 2026-04-25
status: resolved
resolved-date: 2026-04-26
resolution: approve-fix
---

# AutomatonLike — gated on Wes's review

## Resolution (2026-04-26)

**Wes approved the proposed fix.** Shipped in iter-12 as commits `48cc177` (`feat(engine): add preview.ts with computePreview, EdgeOverlay`) and `5d496ee` (`refactor(preview): consume engine/preview; delete duplicated types`).

The structural-shadow type (`AutomatonLike<T extends TransitionLike>`) and the three `as unknown as T` casts are gone. `computePreview` now lives in `src/engine/preview.ts` and takes primitive inputs (no `CreationState` import); the transition editor consumes the engine result directly.

Knowledge file `engine-ui-separation.md` updated in iter-13 to remove the "one known crack" sentence and bump `verified-as-of` to `5d496ee`. Typescript-reviewer's `generic-constraints.md` cautionary-tale entry stands as-is — the cast was still a smell at the time it was identified, even if it has since been removed.

The cross-agent disagreement that audit-001 documented was therefore resolved by user-mediated decision, not by either side conceding. Both agents' historical positions remain on disk as the record of the debate.

## Original question (preserved for record)

The architecture-reviewer holds two contradictory positions on `AutomatonLike<T extends TransitionLike>`:

- `knowledge/engine-ui-separation.md` describes it as "one known crack" with `as unknown as T` casts.
- `journal/2026-04-25-historical-iter7-iter8-review.md` softens this to "borderline-acceptable, not premature abstraction."

The typescript-reviewer disagrees with the architect's softer journal verdict and reinforced their `generic-constraints.md` cautionary-tale verdict instead.

The auditor (audit-001 finding #1, #3) flagged this as both a cross-agent contradiction and an internal contradiction within the architect's own memory.

**Wes has explicitly said he wants to review `AutomatonLike` and similar structures personally before any change lands.** Until that happens, the contradictions should NOT be reconciled.

## Why it mattered

This was the only contradiction in council memory deliberately preserved rather than fixed. It existed because the resolution depended on a project-owner decision that the council could not make.

## What was known

- typescript-reviewer's evidence: cast was present at the introducing commit (`1493832`), 2 internal casts at HEAD plus one caller-side cast in `App.tsx`, single concrete caller in the entire codebase, no second instantiation planned.
- architect's softer reading: localized abstraction with a concrete caller, layering aesthetic motivation.
- Code reality at the open-question's writing (verified by auditor): 2 internal casts, 1 caller cast, 1 caller total.

## How it was resolved

Wes reviewed the structure and approved the proposed fix. The architecture-reviewer's knowledge baseline now matches what the typescript-reviewer was already saying: the abstraction was load-bearing only on the rationale that engine logic wanted to live in the UI layer; once the architect accepted that `computePreview` is engine logic, the abstraction had nothing to defend and was deleted.

Followed by knowledge-file refresh in iter-13. See `.claude/council/architecture-reviewer/knowledge/engine-ui-separation.md`.
