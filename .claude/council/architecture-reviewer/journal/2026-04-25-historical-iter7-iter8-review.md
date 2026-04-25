---
agent: architecture-reviewer
type: journal
iteration: null
date: 2026-04-25
diff-hash: c6da931..30eace9
duration-ms: 194569
schema-version: 1
---

# Historical review: iteration 7→8 (NFA support introduction)

## Diff received

Six commits taking the project from "DFA-only with NFA-friendly data shapes" to working NFA simulation with multi-active-state visualization and a comma-list transition editor. ~3350 lines changed across engine, UI, and the transition-creator subsystem. New engine module (`utils.ts`), new automaton primitives (`addTransitionDestination` / `removeTransitionDestination`), a uniform multi-state simulator, an edge-consolidation pass at the GraphViz boundary, and substantial growth in `creationReducer.ts`.

## My assessment

Approved in retrospect. The iter-1 design prediction — "NFA-compatible data model means NFA support is exercise, not redesign" — was borne out. No core type changed. The simulator unified DFA and NFA into one multi-state codepath with a type gate for DFA-only error semantics. The new engine surfaces (`epsilonClosure`, NFA-friendly transition primitives) sit in correct modules with correct purity. The UI absorbed multi-active-state visualization through scalar fan-out (`nextTransitions` plural) and a new engine→UI signal (`dyingStateIds`) — both natural scalings of existing patterns rather than new abstractions.

The architecturally significant move is **edge consolidation** in the GraphViz boundary (`cf96732`). For the first time the engine's data shape and the visual data shape diverged: engine stores `(from, symbol) → Set<dest>` records; the visual edge groups by `(from, to)` with a `symbols` array. The funnel pattern from iter-3 absorbed this — the regroup happens at exactly the boundary module — but it's now doing real semantic work, not just round-tripping coordinates.

## What I checked

- Engine/UI separation: no React imports in engine/; engine has no UI type imports; one structural shadow type in creationReducer.ts (`AutomatonLike`/`TransitionLike`) with a concrete caller (`computePreview`).
- Immutability: `epsilonClosure` accepts `ReadonlySet`/`ReadonlyArray`, returns new Set; `addTransitionDestination` returns the same automaton on no-op edits (iter-1 reference-equality convention).
- Type evolution: `Transition` unchanged; `Automaton` unchanged; `SimulationStep.currentState` → `currentStates: Set<number>` + new `dyingStateIds: Set<number>`. The iter-1 future-proofing in `Simulation.currentStates: Set<number>` became load-bearing.
- Validator type-gating: DFA-specific structural checks correctly gated behind `automaton.type === 'DFA'`; NFA path requires only alphabet + start state, matching documented semantics.
- Simulator unification: confirmed DFA path is a degenerate case (size-1 active set, ε-closure no-op). DFA dead-end still throws (structural-error contract preserved); NFA dead-end silently shrinks active set. Single codepath, not parallel.
- Edge consolidation boundary: confirmed regroup happens in `automatonToDot` and inverse parse in `parseEdgeLabel`, both inside `src/ui-state/utils.ts` — the same boundary module from iter-3.
- `AutomatonLike` generic origin: confirmed introduced in commit `1493832` (first commit in range, "Iter 7 follow-up"). Has a concrete caller. Not premature abstraction — borderline-acceptable structural shadow.

## What I deliberately did not check

- Test coverage adequacy for ε-closure, multi-state step, dying-branch signal (qa-reviewer's domain).
- Visual correctness of the dying-state fade animation, multi-active pulse rendering (out of scope — UI/UX).
- Whether `computePreview`'s generic should accept a union instead (typescript-reviewer's domain).
- Performance of the O(active_states * transitions) inner loop in `step()` (writer's judgment unless it conflicts with architecture).
- Test impact of the `editingExisting` retention-semantics change.

## Memory updates produced

- This journal entry.
- Open question created: `open-questions/data-shape-divergence-at-graphviz-boundary.md`.
- No new knowledge files. The patterns exercised here all already have knowledge entries — and this iteration validated them rather than introducing new principles.

## Outcome

iter-1's NFA-compatibility prediction was the most consequential design call in the project's history, and it landed cleanly. The engine grew without restructuring; the UI absorbed multi-state visualization without a new framework; the only architecturally new move (edge consolidation) extended an existing boundary pattern rather than inventing one. The project's documented conventions held under their biggest test so far.

## Note on the AutomatonLike structural shadow

The iter-1 code review catalogued `AutomatonLike` as a "crack" in the engine/UI separation. This historical review concludes it's borderline-acceptable: the generic has a concrete caller (`computePreview`) and exists for a real reason (the function returns `ReadonlyArray<T>` and would lose type info under a union). The cost — UI code defining a structural shadow of an engine type — is real but localized. **This is a partial revision of my prior position**, recorded here for the auditor to evaluate.
