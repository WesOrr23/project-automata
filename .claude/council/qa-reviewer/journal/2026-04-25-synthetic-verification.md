---
agent: qa-reviewer
type: journal
iteration: null
date: 2026-04-25
diff-hash: synthetic-qa-001
duration-ms: 61655
schema-version: 1
---

# Synthetic verification: findOrphanedStates in automaton.ts

## Diff received

A new exported function `findOrphanedStates` added to `src/engine/automaton.ts`. Computes "states with no incoming transition" but is named/documented as if it computed unreachability from the start state. No test changes accompanied the diff.

## My assessment

REVISION REQUESTED.

## What I checked

- Whether the function duplicates existing engine API: yes — `getOrphanedStates` already exists in `src/engine/validator.ts:188` with proper BFS-from-start semantics.
- Whether tests exist for the new code: no test file changes; `automaton.test.ts` (~415 lines) is the expected home and was not touched.
- Edge-case soundness: I asserted that `automaton.startState` is `number | null` and that adding it unconditionally to a `Set<number>` would contaminate the set with `null`.
- Doc/code mismatch: doc says "unreachable from any other state" but implementation flags states with no incoming edge — different graph property.

## What I deliberately did not check

- Type-system fallout from the (claimed) null insertion (typescript-reviewer).
- API/architecture question of whether reachability belongs in `automaton.ts` vs `validator.ts` (architecture-reviewer).

## Memory updates produced

- This journal entry.
- No knowledge updates needed in this run; existing notes on engine coverage already cover the duplicate-API and missing-test concerns.

## Outcome

Revision requested. If the goal is reachability, delete and use `getOrphanedStates`. If the goal is "no incoming edges," rename, fix the doc, and add tests in `automaton.test.ts`.

---

## Orchestrator correction note (post-review)

I asserted in the findings above that `automaton.startState` is `number | null`. That was wrong. The actual type at `src/engine/types.ts:79` is `startState: number;` (non-nullable). The architecture-reviewer's memory has this correct.

There IS a `hasStartState` guard in `validator.ts:117` — but its purpose has shifted with the type change: it now verifies that the startState ID is actually a member of the states Set, not that startState is non-null. So the *spirit* of my edge-case concern survives — the synthetic diff doesn't guard against `startState` being a stale ID for a removed state — but my characterization of the type was wrong.

Knowledge update queued: add a knowledge file or expand `test-coverage-map.md` with current data-shape facts (startState non-nullable since iteration-1 review, but `hasStartState` invariant still relevant for stale-ID cases). The auditor should pick this up.
