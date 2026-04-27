---
agent: architecture-reviewer
type: knowledge
topic: engine-ui-separation
schema-version: 1
verified-as-of: 369cd14
last-updated: 2026-04-27
confidence: high
---

# Engine/UI Separation

## Principle

The engine layer (`src/engine/`) has zero React dependencies. UI imports from engine; engine never imports from UI. This is documented in `CLAUDE.md` as a primary architectural invariant.

## Current state

Honored end-to-end as of `5d496ee` (iter-12 close). Engine modules — `automaton.ts`, `simulator.ts`, `validator.ts`, `types.ts`, `utils.ts`, `result.ts`, `preview.ts` — contain only pure TypeScript and have no React or DOM imports. The previously-documented "one known crack" (`AutomatonLike<T extends TransitionLike>` in `creationReducer.ts`) was removed during the iter-12 AutomatonLike consolidation: `computePreview` and its overlay sidecar (`EdgeOverlay`) moved to the engine layer (`src/engine/preview.ts`), and the structural-shadow generic was deleted along with the three `as unknown as T` casts that had existed to satisfy it.

The migration was deliberate: `computePreview` is engine logic operating on engine data. Its previous home in the UI reducer was an organizational accident, and the wrapper type existed only to defer importing the engine `Automaton` directly. With the move, the import goes the right direction (UI → engine) and no shadow type is needed.

## What to look for in diffs

- React imports inside `src/engine/` — hard violation
- DOM, window, document references inside `src/engine/`
- Engine functions taking React-specific types (event handlers, refs, JSX) as parameters
- New code in `src/components/` doing pure data transformation that should live in `src/engine/`
- New `as unknown as T` casts that exist to avoid importing engine types — the AutomatonLike pattern was the canonical example; new instances are highly suspect

## What's fine

- UI files importing engine types (`Automaton`, `Transition`, `EdgeOverlay`, `PreviewOutcome`) and functions — this is the intended direction
- Engine using generic data structures (Set, Map, plain objects) — these aren't UI dependencies
- UI-shaped generics defined inside `src/components/` for component-internal use (e.g., panel prop shapes) — only suspicious when the generic is being used to shadow an engine type

## Provenance

`CLAUDE.md`, "Separation of Concerns" section. Reinforced by the iteration-1 code review (2026-04-25). The iter-12 cleanup is recorded in `journal/2026-04-25-iter12-type-bloat-audit.md` and the resolved open-question `open-questions/automaton-like-pending-user-review.md`.
