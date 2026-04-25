---
agent: typescript-reviewer
type: knowledge
topic: cast-discipline
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# Cast Discipline

## Principle

`as` and `!` are escape hatches. Each one is a place where the compiler's guarantees stop and the developer's reasoning starts. The discipline is to use them only at *opaque boundaries* — where the source of the value is genuinely outside the type system's reach — and never to silence type errors caused by a model mismatch.

## Current state

### Acceptable casts in the codebase

- `parseFloat(coords[0] ?? '0')` style at GraphViz parsing boundaries (`src/ui-state/utils.ts`). The GraphViz output is opaque text; once parsed, types start.
- The `JSON.parse(jsonString)` → `GraphvizJson` seam in `parseGraphvizJson` (`src/ui-state/utils.ts`) does the assertion via object-literal spread from `any`. The boundary is correct (WASM-produced opaque text), but a shape predicate (`isGraphvizJson`) would convert silent malformation into a typed failure.
- JSON deserialization seams when loading sample automatons. The on-disk shape is `string | number | array`; we cast the parsed result to the engine's structured types after validating shape.
- WASM-FFI boundaries (the GraphViz WASM call). We don't control the WASM's TypeScript declarations entirely.

### Smells already catalogued

- `src/components/transitionEditor/creationReducer.ts` uses `as unknown as T` casts inside `computePreview` (the symbol-modify branch and the structural-modify branch). These exist to bridge a generic abstraction (`AutomatonLike<T extends TransitionLike>`) that doesn't quite fit. The casts are not at an opaque boundary — they're papering over a type-model mismatch internal to the codebase. Recorded in the project's "Major Changes Proposed" backlog as: kill the generic, import `Automaton` directly. The caller of `computePreview` in `src/App.tsx` additionally casts `preview.transitions as Automaton['transitions']`, present since the introducing commit `1493832`. This caller-side cast is part of the same generic-abstraction smell — kill the generic, kill both sides together. Re-verified at HEAD: 2 internal casts + 1 caller cast (audit-001 finding #5).

### `!` (non-null assertion) usage

- `src/engine/automaton.ts` `removeState` has `remaining[0]!` after a `.size === 1` early return guarantees the remainder is non-empty. In iteration-1 review, the comment was rewritten to point at the size-check invariant. Acceptable: the assertion is load-bearing on a documented local invariant.

## What to look for in diffs

- New `as T` or `as unknown as T` *inside* application code (not at parser/JSON/FFI boundaries). Each one is a question: what type-model mismatch is this hiding?
- New `!` assertions without a comment pointing at the invariant that justifies them.
- `as any` — never acceptable in this codebase. There's always a better alternative.
- Casts that look like "I just want this to compile" — usually visible by a comment like "// type system being weird" or no comment at all.

## What's fine

- Casts at any of the established opaque boundaries above, with a brief comment if the boundary isn't obvious.
- Type narrowing via type predicates (`function isFoo(x: unknown): x is Foo`) — preferred over `as Foo`.
- `satisfies` — usually preferred over `as` when the goal is "ensure this matches T but keep the precise inferred type."

## Provenance

`creationReducer.ts` casts catalogued in iteration-1 code review. `removeState` `!` assertion verified in same review.
