---
agent: qa-reviewer
type: knowledge
topic: data-shape-facts
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# Data Shape Facts (current)

## Principle

Hard facts about the engine's current data-model that QA reasoning needs to start from. These are properties that the type system enforces; reviews that assume otherwise will produce wrong findings. This file exists because the inaugural audit (`audit-001`) caught the qa-reviewer asserting `startState: number | null` when it is in fact non-nullable — a correction that was queued in the synthetic-verification journal but never propagated to knowledge.

## Current state

### `startState` is non-nullable

`Automaton.startState: number` (engine/types.ts). It is not nullable. This was confirmed in the iteration-1 code review and the corresponding doc drift (CLAUDE.md describing it as `number | null`) was fixed at that time.

### `hasStartState` is still meaningful

`hasStartState(automaton: Automaton): boolean` exists in `src/engine/validator.ts`. Its purpose is **not** to check whether `startState` is null (the type prevents that). Its purpose is to verify that the `startState` value is actually a member of `automaton.states` — which can fail if a state was removed without `startState` being updated, or if an automaton was constructed with a stale ID.

When a function operates on `automaton.startState`:

- The type guarantees it's a `number`. No null-check needed.
- It does NOT guarantee the number is a valid state ID. If the function reads `automaton.states.has(automaton.startState)` and acts on the result, that's the right check.

### `Transition.to` is `Set<number>`, not `number`

`Transition.to: Set<number>` since iteration 1 (DFA-first, NFA-compatible). Even DFA transitions have a Set destination of size 1. Code that treats `transition.to` as a single number is wrong; iterating with `Array.from(transition.to)` is correct.

### `Transition.symbol` is `string | null`

`null` represents an ε (epsilon) transition. The engine accepts `null` only when `Automaton.type === 'NFA'`; DFA transitions have non-null symbols.

### `SimulationStep.currentStates: Set<number>` (since iter 8)

Pre-iter-8: `currentState: number` (single). Post-iter-8: `currentStates: Set<number>` (the multi-active state model that NFA simulation requires; DFA is a degenerate case with size 1). Code that assumes a single current state is wrong.

## What to look for in diffs

- Code that null-checks `automaton.startState` — dead code per type. Either delete the check, or replace with `automaton.states.has(automaton.startState)` if the intent is "is this a valid ID."
- Code that assumes `transition.to` is a number.
- Code that adds `automaton.startState` to a `Set<number>` without first verifying it's a member of `automaton.states` — if it's stale, the Set will contain a phantom ID.
- Code that operates on `simulation.currentState` (singular) — the field is `currentStates` (plural Set) since iter 8.

## Why this matters

The synthetic-verification run had qa-reviewer assert that a hypothetical function would crash by adding `null` to a `Set<number>`. The code did NOT have that bug because `startState` is not nullable. There was a different real bug (the function didn't check if the startState was actually present in `states`), but the framing was wrong.

Future qa-reviewer runs should check this knowledge file before reasoning about engine data shapes.

## Provenance

Audit-001 finding #4 (the orchestrator-correction-not-propagated case). Verified by reading `src/engine/types.ts:79`, `src/engine/validator.ts:117`, and the engine `Automaton` shape at HEAD (`52bdb8e`).
