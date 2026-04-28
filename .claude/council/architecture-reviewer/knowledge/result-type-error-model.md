---
agent: architecture-reviewer
type: knowledge
topic: result-type-error-model
schema-version: 1
verified-as-of: 107ab42
last-updated: 2026-04-27
confidence: high
---

# Result Type Error Model

## Principle

The engine layer returns `Result<T>` for any operation that can fail in a way the UI must handle. Errors are typed string-literal variants (the `EngineError` union), not raw strings. The `applyEdit` boundary in the UI consumes the Result and surfaces a notification on `!ok`. Throws are reserved for programmer-fault contracts (e.g., constructing an automaton with an empty alphabet — a precondition violation, not a user-recoverable error).

## Origin

Iteration 11. Replaced the iter-1-era pattern of "engine throws on bad input; UI catches in `applyEdit` (with a double-call workaround for StrictMode `notify()` side-effects)."

## Shape

```typescript
// src/engine/result.ts
export type EngineError =
  | 'state-not-found'
  | 'transition-already-exists'
  | 'epsilon-not-allowed-in-dfa'
  | ...; // string-literal union, exhaustively listed

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: EngineError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = (error: EngineError): Result<never> => ({ ok: false, error });
export function errorMessage(error: EngineError): string { /* total switch */ }
```

The `errorMessage` helper is the *only* place strings live; it converts the typed variant to a user-facing string at the notification boundary.

## Reference-equality no-op preservation

Engine functions that perform an operation with no logical effect (e.g., `addAcceptState` for an already-accept state) return `ok(automaton)` with the **same reference**. This preserves the `useUndoableAutomaton.setAutomaton` short-circuit pattern: identical-reference returns skip the history push.

This means `Result<Automaton>` does not break the immutability discipline — it wraps it without disturbing reference-equality semantics.

## What to look for in diffs

- New engine functions that throw on user-recoverable input rather than returning `Result<T>` — should be `Result`-returning unless there's a programmer-fault contract.
- New `EngineError` variants added without a corresponding `errorMessage` case — caught by exhaustive switch, but worth flagging if the variant doesn't match the existing taxonomy.
- Callsites that ignore the `Result` (no `if (!result.ok)` branch) — silent failures.
- Callsites that destructure `Result` as if it were unwrapped — type error, but the intent (treating it as throwing) is wrong direction.
- Internal helpers that throw — fine if not exported; only the public engine surface needs `Result`.

## What's fine

- Programmer-fault throws (preconditions, contract violations) — `createAutomaton` empty-alphabet check is the canonical example.
- Boundary `unwrap` helpers in known-good construction (e.g., `buildSampleDFA` in App.tsx) — the construction is controlled and any error is a programmer fault.
- Internal helpers that throw to simplify control flow — only the exported boundary needs `Result`.

## "Silently drop" exception (audit-002 F9, audit-003 F2)

There is one *deliberate* `Result`-discarding callsite: `useSimulation.jumpTo` early-breaks out of its step-loop on a failed step rather than surfacing the error. The reasoning: `jumpTo` is a "fast-forward N steps" UI helper; if the FA hits an error mid-walk (rare and indicates a deeper bug, not a user-recoverable condition), stopping at the last good step is the right user-facing behavior — surfacing a notification mid-jump would be confusing.

The pattern to distinguish: **drop with a comment is acceptable**; **drop without a comment is a regression to flag**. A reviewer scanning the diff should see explicit reasoning at every Result-ignoring callsite. Currently exactly one such site exists; verified at HEAD `107ab42`.

This belongs here (in the architect's knowledge) rather than in the typescript-reviewer's `discriminated-unions.md` because it's an architectural decision about error-handling discipline, not a type-system concern. TS notes the existence of the exception in passing; this file is the authoritative description.

## Provenance

Iteration 11 implementation. `src/engine/result.ts` for the type definitions; `src/engine/automaton.ts`, `simulator.ts` for the conversion. Architectural decision recorded in the original code-review debate as a Major Change Proposed; landed in iter-11 ahead of iteration 11+.
