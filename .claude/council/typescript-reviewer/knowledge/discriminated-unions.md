---
agent: typescript-reviewer
type: knowledge
topic: discriminated-unions
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# Discriminated Unions

## Principle

Discriminated unions on string literals are preferred over enums in this codebase. They serialize trivially, narrow cleanly in switches, and pair naturally with exhaustiveness checking via the `never` type. Switches over discriminated unions should always include either a `default: const _exhaustive: never = x; throw ...` arm or rely on a type-asserted exhaustive helper.

## Current state

### Examples in the codebase

- `Automaton.type: 'DFA' | 'NFA'` — top-level shape discriminator.
- Notification target shape: `{ kind: 'state'; ... } | { kind: 'transition'; ... }` (verified in `src/notifications/types.ts`).
- Reducer action types use `type: '...'` discriminants throughout (`creationReducer.ts`, `useSimulation.ts`).

### Engine errors (planned)

The "Engine returns Result types" Major Change in the iteration-1 backlog will introduce a discriminated error type:

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: 'duplicate' | 'invalid-state' | 'not-found' | ... };
```

The error variants will themselves be a string-literal union — typed errors, not stringly-typed errors. This is an active project decision (architecture-reviewer's territory), and the typescript-reviewer's role is to verify the implementation matches.

## What to look for in diffs

- New `enum` declarations — push back unless there's a clear reason (interfacing with code that requires real enums, e.g., generated bindings).
- Switches over discriminated unions that don't have an exhaustiveness check — adding a `default: never` arm catches accidentally-missed variants when a new variant is added.
- Discriminant fields that aren't string literals (e.g., `type: number`) — usually means the union was derived from a type the codebase doesn't own; check whether mapping to a string-literal union at the boundary is feasible.
- New variants added to a union without updating every switch over that union — find them via grep, flag any that lack the exhaustiveness check.

## What's fine

- Discriminated unions on number-literal types when the value comes from an external numeric protocol.
- Boolean discriminants for two-variant unions (`{ ok: true; ... } | { ok: false; ... }` is the canonical example).
- Optional fields *within* a variant (not as the discriminant — discriminants must be required).

## Provenance

CLAUDE.md "Coding Preferences & Conventions" section — discriminated unions over enums. Verified in `notifications/types.ts`, `creationReducer.ts`, `useSimulation.ts`.
