---
agent: qa-reviewer
type: knowledge
topic: testing-philosophy
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# Testing Philosophy

## Principle

Test at the layer where the code lives. Engine logic gets unit tests. Hooks get hook tests. Components will get component tests (RTL) when adopted. Avoid:

1. End-to-end tests for things that can be unit-tested.
2. Heavy mocking that turns a test into a description of itself.
3. "Coverage by quantity" — many shallow tests that don't add confidence.

The goal is *confidence that the code does what it says*, not coverage percentage.

## Test pyramid for this codebase

```
       [ App-level integration tests ]   ← essentially none today; sparse target
      [    Component tests (RTL)     ]   ← none today; primary growth target
     [    Hook tests                  ]   ← well covered
    [   Reducer tests                  ]  ← well covered (some gaps in computePreview)
   [   Engine unit tests                ] ← gold standard; thoroughly covered
```

## When to test what

- **Pure functions in `src/engine/` or `src/ui-state/`**: unit test. Cheap, fast, exhaustive.
- **Reducers**: unit test the reducer function directly. Don't render anything.
- **Hooks (`src/hooks/`)**: hook tests with `renderHook`. Drive via `act()`, assert on returned state.
- **Components**: component tests with RTL. Render, interact via `fireEvent` or `userEvent`, assert on rendered output. (Not yet adopted; flag when components are touched.)
- **App-level flows**: a small number of integration tests asserting "click here, see this happen." Don't try to cover everything end-to-end.

## When NOT to add a test

- The code is purely typeful (a type alias, an interface) — types are checked by `tsc`, not by tests.
- The code is a one-line passthrough.
- A test would only assert that a constant has its declared value.
- The test would require so much mocking that you're testing the mocks.

## Counter-patterns

- **The "function exists" test** — `expect(typeof addState).toBe('function')`. Pointless.
- **The "nothing throws" test** — `expect(() => doThing()).not.toThrow()`. Says almost nothing.
- **The implementation-detail test** — asserts on private fields or call sequences. Fragile.
- **The over-mocked integration test** — mocks every dependency, then asserts on the mocks' call args. Tests the test, not the system.

## What I push back on

- A diff that adds engine code without engine tests.
- A diff that touches a component but only adds engine tests.
- "I tested it manually" as a substitute for an automated test on testable code.
- 100%-coverage targets that incentivize adding shallow tests.
