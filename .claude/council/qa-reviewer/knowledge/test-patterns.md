---
agent: qa-reviewer
type: knowledge
topic: test-patterns
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# Test Patterns

## Principle

This codebase uses Vitest for unit and hook testing. RTL (React Testing Library) is the agreed direction for component testing but not yet adopted. Tests follow the engine's functional style: assert against return values, not against internal state.

## Current state

### Naming

- Test files mirror source: `automaton.ts` → `automaton.test.ts`, in the same directory.
- Test descriptions use `describe(<module or function>, () => ...)` with `it('does specific thing', ...)`.
- No `test()` aliases; consistently `describe`/`it`.

### Structure

- `describe` blocks group by function or behavior.
- Setup is per-test where lightweight; `beforeEach` only when shared state is necessary.
- Each test asserts on the return value of an engine function or reducer transition. No mocking of pure functions.

### Engine tests (the gold standard in this codebase)

- Build automatons by calling the actual API (`createAutomaton`, `addState`, `addTransition`).
- Assert on returned automaton shape and value equality.
- Include immutability assertions: verify the input automaton was not mutated.

### Hook tests

- Use `@testing-library/react`'s `renderHook` for hook tests.
- Drive transitions via `act()` and the hook's returned dispatchers.
- Assert on the hook's returned state object.

### What good looks like

A meaningful test names a specific behavior, exercises one path through the code, and asserts on the observable output. Counter-example: a test that calls a function and asserts only that "no error was thrown" verifies almost nothing.

## What to look for in diffs

- Tests that mock pure engine functions: this defeats the whole point of testing them. Never necessary.
- `it` descriptions that describe implementation rather than behavior ("calls setX with Y" vs "moves to the next state").
- Tests that reach into internal state (`hook.current.refs.somePrivateThing`) — fragile and indicates the API isn't right.
- Tests that require many lines of setup to assert one thing: usually means the API is too coupled.
- Snapshot tests for anything but stable structural output.

## What's fine

- Mocking external boundaries (GraphViz WASM, browser APIs) when present.
- Testing the same function multiple times with different inputs (boundary cases, error paths).
- Asserting on side effects when those side effects are the contract (e.g., notifications fired).

## Provenance

Verified by reading `automaton.test.ts`, `useSimulation.test.ts`, `useUndoableAutomaton.test.ts`, `creationReducer.test.ts`, `NotificationContext.test.tsx` at commit `52bdb8e`.
