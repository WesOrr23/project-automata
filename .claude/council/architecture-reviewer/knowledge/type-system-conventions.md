---
agent: architecture-reviewer
type: knowledge
topic: type-system-conventions
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# Type-System Conventions

## Principle

Several deliberate choices shape how types are used in this codebase:

1. **Sets for uniqueness-constrained collections** — `states`, `alphabet`, `acceptStates`, transition destinations. Prevents duplicate-via-construction.
2. **Plain objects, no classes** — functional style. Aligns with React state immutability and JSON serialization.
3. **Dependencies-first type ordering** — `Transition` is defined before `Automaton` because `Automaton` depends on it. Makes file structure predictable.
4. **`tsconfig` strict flags** — `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true` (added in iteration-1 review).
5. **Discriminated unions over enums** — `type: 'DFA' | 'NFA'` style, not `enum AutomatonType`. Pairs naturally with switch exhaustiveness.

## Current state

All five conventions are honored. The codebase has zero classes, uses Sets consistently, and has dependency-ordered types.

## What to look for in diffs

- New `class` declarations in `src/` (allowed only with explicit justification)
- Arrays where Sets are expected (e.g., `states: number[]` instead of `states: Set<number>`)
- Forward references in type definitions where dependency-first ordering would prevent them
- Loosening of `tsconfig` strict flags
- New `enum` declarations (prefer discriminated string unions)

## What's fine

- Arrays in JSON serialization (Sets don't serialize directly; arrays are the on-disk form)
- `as` casts at well-defined interface boundaries (e.g., parsing GraphViz output, parsing JSON) when the source is opaque
- Internal type aliases or branded types when they clarify intent

## Provenance

`CLAUDE.md` "Coding Preferences & Conventions" section. The `noImplicitOverride` flag was added in the iteration-1 code review.
