---
agent: architecture-reviewer
type: knowledge
topic: state-id-management
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# State ID Management

## Principle

The engine owns state identity (numeric auto-incremented integers tracked by `nextStateId`). The UI layer owns display labels (e.g., mapping ID `0` to label `"q0"`). Engine functions return both the new automaton and the generated ID; the caller doesn't supply IDs.

## Current state

Honored. `Automaton.states` is `Set<number>`. `addState` returns `{ automaton, stateId }`. The UI layer's `createDefaultLabel` helper maps IDs to display labels.

`startState` is non-nullable in the type system (`startState: number`). When the start state is removed, `removeState` auto-assigns to the lowest remaining state ID. (Earlier doc drift describing it as nullable was fixed in the iteration-1 review.)

## What to look for in diffs

- Engine APIs that take a `stateId: number` parameter for `addState`-style operations (the engine should generate the ID, not accept one)
- Stringly-typed state references in engine code (`'q0'` instead of `0`)
- Display labels leaking into engine logic (e.g., engine functions concatenating `"q" + id`)
- Code that bypasses `nextStateId` to construct state IDs directly
- New nullable types around `startState` (it should remain non-nullable)

## What's fine

- UI components computing display labels via the layer's helpers
- JSON serialization converting numeric IDs to/from arrays (this is a serialization concern, not an identity concern)
- Tests asserting specific numeric IDs (these are auto-generated and predictable)

## Provenance

`CLAUDE.md` "ID Management" section. The non-nullability of `startState` was confirmed in the iteration-1 code review (and a corresponding doc drift was fixed at that time).
