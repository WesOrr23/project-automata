---
agent: typescript-reviewer
type: journal
iteration: null
date: 2026-04-25
diff-hash: 14bb9e8..ebdb064
duration-ms: 118010
schema-version: 1
---

# Iter 1 → Iter 2 historical review: UI types layer introduced

## Diff received

End of iter 1 (engine types only) → end of iter 2 (first SVG visualization). Added `src/ui-state/types.ts` (`StateUI`, `AutomatonUI`, `createDefaultLabel`) and four components: `StateNode`, `StartStateArrow`, `TransitionEdge`, `AutomatonCanvas`. `App.tsx` rewritten to assemble a sample DFA and render it.

## My assessment

Approved (historical). The iter-2 types layer was disciplined and durable.

## What I checked

- `tsconfig.json` strictness at the boundary — identical to today except for `noImplicitOverride` added later. Already had `strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`.
- Casts/`!`/`any` introduced in this range — zero. Full discipline.
- UI-engine boundary — `id: number` foreign key, no engine type imports into `ui-state/types.ts`, no UI imports into engine. Clean.
- Mirror pattern (`AutomatonUI` ↔ `Automaton`) — established here, survives to today (current `AutomatonUI` extends with `TransitionUI` but keeps the shape).
- "Prop" suffix convention — established consistently across all four new components.
- Granular-prop pattern — chosen here. Type-level cost: `x`/`y` invariants not bound at the type level (caller could swap them). Documented as a trade-off, not a bug.
- `noUnusedParameters` handling — `_isStart` rename pattern in `StateNode` is the correct idiom under the flag.
- `Map.get` undefined-handling — every callsite respects `T | undefined`, no `!` to bypass.
- NFA-compatibility at render — `Array.from(transition.to).map(...)` works correctly with the Set-of-destinations design.
- `symbol: string | null` rendering — matches engine type exactly; iter-2 idiom scaled into `TransitionUI.symbols: ReadonlyArray<string | null>`.

## What I deliberately did not check

- Component runtime behavior (qa-reviewer)
- Layout/geometry correctness of arrow math in `TransitionEdge` (qa-reviewer)
- Whether granular-prop vs object-prop is the right architecture choice (architecture-reviewer)
- IIFE inside JSX in `AutomatonCanvas` — type-correct, style concern.

## Memory updates produced

- This journal entry.
- No knowledge updates: the four existing knowledge files (`strict-flags`, `cast-discipline`, `discriminated-unions`, `generic-constraints`) all remain accurate — this diff doesn't introduce new doctrine, it confirms existing doctrine was followed from the start. A future `ui-engine-boundary.md` knowledge file would be a strong candidate but is premature on a single diff's evidence.

## Outcome

Approved historically. The iter-2 type decisions hold up — they are part of why the codebase later avoided UI-side type debt. The one decision worth flagging as a long-term watch is the granular-prop pattern: the loss of `{x, y}` covariance at the type level is real, and any later "swapped-coordinate" bug should re-examine the choice.
