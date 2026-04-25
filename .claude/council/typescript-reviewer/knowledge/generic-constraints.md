---
agent: typescript-reviewer
type: knowledge
topic: generic-constraints
schema-version: 1
verified-as-of: 30eace9
last-updated: 2026-04-25
confidence: high
---

# Generic Constraints

## Principle

A generic type parameter only earns its keep when the function genuinely operates over a *range* of types and that range can be expressed via a constraint. A generic with an unsatisfiable constraint, with `as unknown as T` coercions inside, or with only one concrete caller, is almost always an abstraction error — usually a way to avoid an honest dependency.

## Current state

### The cautionary tale: `AutomatonLike<T extends TransitionLike>`

Defined in `src/components/transitionEditor/creationReducer.ts`. The generic exists to avoid importing the engine's `Automaton` type into a UI-located file (a motivation that doesn't survive scrutiny — UI importing engine is permitted by the layering rules). Inside `computePreview`, `as unknown as T` casts appear at the synthesized-transition literal in both the symbol-modify branch and the structural-modify branch — the constraint `T extends TransitionLike` is loose enough that TypeScript can't prove the produced values match `T`. There is exactly one caller, and that caller passes the engine's actual `Automaton`, then immediately casts the result back: `preview.transitions as Automaton['transitions']` in `App.tsx`. So:

- The generic isn't ranging over multiple types.
- The constraint is loose (the internal casts prove this).
- The caller pays a second cast on the way out, so the generic does not even produce a clean callsite — it relocates a cast from inside the function to outside it.
- Removing the generic and importing `Automaton` directly would give better type information at the callsite *and* eliminate all three casts.

This is the canonical example of "the generic is the workaround, not the design." Recorded in the project's "Major Changes Proposed" backlog (gated on user review pending — see `architecture-reviewer/open-questions/automaton-like-pending-user-review.md`).

### Acceptable generics in the codebase

- Standard library generics: `Set<T>`, `Map<K, V>`, `Array<T>`, `Promise<T>`. Always fine.
- React's `useState<T>`, `useReducer<T>` — fine, the constraint is the value shape.
- Helper functions that legitimately work over multiple types — e.g., a hypothetical `lastOf<T>(array: T[]): T | undefined`.

## What to look for in diffs

- New generics with no constraint or `<T extends unknown>` — almost always wrong.
- New generics where every internal use coerces with `as` — the constraint isn't doing real work.
- New generics with one concrete caller in the same diff — speculative abstraction; ask why it isn't a concrete type.
- Constraints that mention domain-specific structural types (`<T extends TransitionLike>`) — review the placement: is the function in the wrong layer?

## What's fine

- Generics on functions that genuinely range over types and where the constraint captures real shared structure.
- Generics that accept an explicit type argument at the callsite (the type is part of the API, not inferred from runtime values).
- Type-level utility generics (`Pick`, `Omit`, `Extract`, custom mapped types).

## Provenance

`creationReducer.ts` `AutomatonLike` cataloged in iteration-1 review. **2026-04-25 update**: re-verified during iter 7→8 historical review (commit `1493832`). The generic was born with one `as unknown as T` cast already inside `computePreview`, plus a second cast at the sole caller (`App.tsx`'s `preview.transitions as Automaton['transitions']`). Architect's iter 7→8 revision toward "borderline acceptable" was evaluated and rejected: the "no engine import in UI" motivation is invalid (UI may import engine), and the "would lose info under a union" defense has no referent (single concrete caller, no plan for a second). Position reinforced, not revised.
