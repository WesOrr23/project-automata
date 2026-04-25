---
agent: architecture-reviewer
type: knowledge
topic: immutability-discipline
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# Immutability Discipline

## Principle

All engine functions return new automatons. They never mutate the input. This is documented in `CLAUDE.md` and is fundamental to React state integration and JSON serialization.

## Current state

Honored throughout the engine. Operations like `addState`, `removeState`, `addTransition`, etc. construct new Sets/Maps and return new top-level objects.

Reference equality is used as a no-op signal: when an operation would produce no change, it returns the input unchanged. `useUndoableAutomaton.setAutomaton` short-circuits on `nextAutomaton === previousSnapshot.automaton` to avoid pushing redundant snapshots onto the undo stack. This is performance-critical and intentional.

Caller-side no-op guards exist for cases where the engine cannot detect content equality (e.g., `new Set([...prev, x])` always allocates even if `x` is already in the set). These are duplicated logic and recorded in the backlog as a Major Change: short-circuit at the engine for content-equal Set operations.

## What to look for in diffs

- Engine functions that mutate parameters (push, splice, `.add()` to a passed Set, etc.)
- Engine functions returning the same object reference after a "modification" (would break the no-op-detection contract)
- New engine surface that takes a callback intended to mutate state in place
- React state updaters that mutate previous state instead of returning new state

## What's fine

- Engine functions returning the input unchanged when no logical change occurred
- Local mutation of newly-constructed values before returning them (e.g., building up a Set, then returning it)
- UI hooks using mutable refs for non-React-state concerns (DOM measurements, debounce timers)

## Provenance

`CLAUDE.md` "Immutability" section. The reference-equality no-op pattern was catalogued in the iteration-1 code review.
