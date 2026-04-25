---
agent: architecture-reviewer
type: knowledge
topic: engine-ui-separation
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# Engine/UI Separation

## Principle

The engine layer (`src/engine/`) has zero React dependencies. UI imports from engine; engine never imports from UI. This is documented in `CLAUDE.md` as a primary architectural invariant.

## Current state

Mostly honored. Engine modules (`automaton.ts`, `simulator.ts`, `validator.ts`, `types.ts`, `utils.ts`) contain only pure TypeScript and have no React or DOM imports.

One known crack: `src/components/transitionEditor/creationReducer.ts` defines a generic `AutomatonLike<T extends TransitionLike>` to avoid importing the engine `Automaton` type directly. This results in `as unknown as T` casts. The function it uses this for (`computePreview`) is engine-shaped logic on engine-shaped data; it sits in the UI layer only because the reducer that calls it does. Recorded in the project's "Major Changes Proposed" backlog as: move `computePreview` to `engine/preview.ts`.

## What to look for in diffs

- React imports inside `src/engine/` — hard violation
- DOM, window, document references inside `src/engine/`
- Engine functions taking React-specific types (event handlers, refs, JSX) as parameters
- New code in `src/components/` doing pure data transformation that should live in `src/engine/`
- New `as unknown as T` casts that exist to avoid importing engine types

## What's fine

- UI files importing engine types (`Automaton`, `Transition`) and functions — this is the intended direction
- Engine using generic data structures (Set, Map, plain objects) — these aren't UI dependencies
- UI-shaped generics defined inside `src/components/` for component-internal use

## Provenance

`CLAUDE.md`, "Separation of Concerns" section. Reinforced by the iteration-1 code review (2026-04-25), which catalogued the `AutomatonLike` crack.
