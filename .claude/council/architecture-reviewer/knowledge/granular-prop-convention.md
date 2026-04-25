---
agent: architecture-reviewer
type: knowledge
topic: granular-prop-convention
schema-version: 1
verified-as-of: ebdb064
last-updated: 2026-04-25
confidence: high
---

# Granular Prop Convention

## Principle

UI components accept granular scalar/primitive props rather than engine-shaped objects. Only one component per render tree (the canvas-level orchestrator) handles `Automaton` / `AutomatonUI` directly; it destructures down to primitives before passing data to leaf components.

Prop type names use the singular "Prop" suffix (e.g., `StateNodeProp`, not `StateNodeProps`).

## Origin

Established in iteration 2 (commit `ebdb064`) when the visualization layer was first introduced. `AutomatonCanvas.tsx` is the sole consumer of `Automaton` and `AutomatonUI` shapes; `StateNode`, `TransitionEdge`, and `StartStateArrow` take only primitives like `x`, `y`, `symbol`, `stateRadius`.

## Why it matters

- Decouples leaf components from engine types — they can be reused with different data sources.
- Keeps the engine→UI dependency funnel narrow: only the canvas-level component needs to know engine shapes.
- Reinforces engine/UI separation by minimizing the surface area where engine types appear in the UI tree.

## What to look for in diffs

- A new leaf component taking `Transition`, `Automaton`, or `StateUI` directly as a prop — likely a violation; the component should take primitives.
- A new component using the plural `Props` suffix — convention drift.
- A non-canvas component importing from `src/engine/types` — usually indicates the granular-prop pattern was skipped.

## What's fine

- Canvas-level / orchestrator components handling `Automaton` and `AutomatonUI` directly.
- Components in the simulation or editor layer handling richer UI-layer types (e.g., transition editor state) — the convention is about engine types crossing into leaf rendering, not about all richness everywhere.

## Provenance

`CLAUDE.md` "Decided in Iteration 2" section. Iter-2 components in `src/components/StateNode.tsx`, `TransitionEdge.tsx`, `StartStateArrow.tsx`, `AutomatonCanvas.tsx` (verified at commit `ebdb064`).

## Known type-level cost (recorded by typescript-reviewer)

The granular-prop choice loses a covariance: `x` and `y` are independent props, so a caller could swap them without compile-time detection. An object-prop pattern (`position: { x, y }`) would bind those invariants at the type level. Trade-off accepted in iteration 2; worth re-examining if a coordinate-swap bug ever surfaces.
