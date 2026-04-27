---
agent: typescript-reviewer
type: knowledge
topic: strict-flags
schema-version: 1
verified-as-of: 369cd14
last-updated: 2026-04-27
confidence: high
---

# Strict Flags

## Principle

The `tsconfig.json` should be as strict as the codebase can sustain. Flags that catch real bugs at compile time are paid for many times over by reduced runtime debugging.

## Current state

The active `tsconfig.json` enables:

- `strict: true` — turns on all the canonical strict-mode flags (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`).
- `noUncheckedIndexedAccess: true` — array/object index access returns `T | undefined`. This catches the classic "I assumed this index was populated" bug.
- `noImplicitOverride: true` — added in iteration-1 review. Free for now (no classes), locks in the requirement if classes ever appear.
- `exactOptionalPropertyTypes: true` — enabled in iter-11 (commit
  `3607000`). Distinguishes `field?: T` (omit-only, undefined NOT
  assignable) from `field?: T | undefined` (omit OR undefined). The
  audit pass the flag was meant to force did happen — see
  `optional-prop-policy.md` for the per-site rule the codebase settled
  on (widen for ternary-producing callsites, omit-only otherwise,
  spread-conditional for serialization boundaries).

## What to look for in diffs

- Any flag being **disabled** — needs strong justification.
- Any new `// @ts-ignore` or `// @ts-expect-error` — should never appear without a tracking comment explaining why.
- New code that would be ill-formed under any currently-enabled strict flag — usually means an `as` cast was used to silence the error.
- Indexed access that doesn't account for `T | undefined` (since `noUncheckedIndexedAccess` is on, the type system requires this; a missing check means an `as` or `!` is hiding it).

## What's fine

- Adding new strict flags — generally welcome, with a corresponding audit pass.
- `// @ts-expect-error` *with* a comment explaining the specific reason and a TODO referencing a fix path.
- Disabling a flag in a generated file (if it ever exists) — flag for review, but acceptable.

## Provenance

`tsconfig.json` at commit `52bdb8e`. `noImplicitOverride` was added in the iteration-1 code review.
