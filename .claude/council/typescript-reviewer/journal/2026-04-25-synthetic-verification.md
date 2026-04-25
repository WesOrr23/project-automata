---
agent: typescript-reviewer
type: journal
iteration: null
date: 2026-04-25
diff-hash: synthetic-ts-001
duration-ms: 52902
schema-version: 1
---

# Synthetic verification: symbolUtils.ts

## Diff received

A new module `src/components/transitionEditor/symbolUtils.ts` exporting three helpers: `dedupeSymbols<T extends string | null>`, `symbolsMatch(a: any, b: any)`, and `getSymbolKey(transition)` with a bare `@ts-ignore`. No callers in the diff.

## My assessment

REVISION REQUESTED.

## What I checked

- `any` usage: `symbolsMatch(a: any, b: any)` — no opaque boundary justifies it; domain is `string | null`, so the proper signature is `(a: string | null, b: string | null)` and the internal `as string` casts disappear via narrowing.
- `@ts-ignore` policy: bare `@ts-ignore` violates strict-flags doctrine; should be `@ts-expect-error` with a comment. Worse, the suppression hides a missing `Transition` import — the right fix is to import the type, not suppress the error.
- Generic constraints: `<T extends string | null>` on `dedupeSymbols` with no shown caller is speculative. Single-caller generics generally simplify to concrete types.
- `?? '__epsilon__'` sentinel: collides with a legal user symbol; type-side fix would be a discriminated-union return type, but this is also a runtime-correctness concern (handed off to qa-reviewer).
- Case-folding in `symbolsMatch`: not type-detectable; handed off to qa-reviewer.

## What I deliberately did not check

- Whether the module belongs in `components/` or `engine/` (architecture-reviewer).
- Test coverage for the new helpers (qa-reviewer).
- Runtime semantics of the case-fold and sentinel choices (qa-reviewer).

## Memory updates produced

- This journal entry.
- No knowledge updates required: every finding maps to existing knowledge (`cast-discipline.md`, `strict-flags.md`, `generic-constraints.md`, `discriminated-unions.md`).
- Note for future audits: if a real diff lands with similar shape, consider adding `symbolUtils.ts` to the "smells already catalogued" section of `cast-discipline.md` alongside the `creationReducer.ts` casts.

## Outcome

Revision requested. Recommended fixes: type `symbolsMatch` precisely, replace `@ts-ignore` with proper import, simplify the generic to a concrete type, hand off semantic concerns to qa-reviewer.
