---
agent: typescript-reviewer
type: journal
iteration: 11-12
date: 2026-04-27
diff-hash: 77de9ca..369cd14
schema-version: 1
---

# Combined iter-11 + iter-12 sweep — exactOptionalPropertyTypes policy + cast review

## Diff received

Catch-up sweep. iter-12 was already journalled in `2026-04-26-iter12-sweep.md`; this pass extends through iter-13–iter-19 (commands ops, file save/load, command bar, image export, equivalence, complement, minimization). The orchestrator framed it as iter-11 + iter-12 because (a) audit-002 P5/P6 left me stale on iter-11 (`exactOptionalPropertyTypes` enablement, `Result<T>` shipping) and (b) audit-002 F8 needed a TS-reviewer position on the prop-widening pattern.

`tsc --noEmit` at HEAD (`369cd14`): **7 errors, all in `CanvasZoomControls.test.tsx`. Production code clean.**

## My assessment

**Approved.** The codebase is operating a coherent exactOptionalPropertyTypes policy that the architect's iter-11 close-out commit (`3607000`) articulated per-site but no knowledge file captured. F8's framing of "the audit pass was bypassed for components" is overstated — the per-site reasoning was sound, just not promoted into knowledge. This sweep promotes it.

Two real cast smells found, both medium-or-lower severity. One dead cast in image export. The 7 test-file TS errors are real but trivial (missing required props on a fixture).

## What I checked

- `tsconfig.json` flags: confirmed `exactOptionalPropertyTypes: true` is on. Confirmed the related strict family (`strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`) all on.
- All `?: ... | undefined` widenings in `src/` (31 in non-test code). Walked each prop-typed cluster (`AutomatonCanvas`, `StateNode`, `TransitionEdge`, `useCanvasViewport`, notifications) and matched against its callsite shape in `App.tsx`. Pattern: widening is paired with `cond ? value : undefined` ternaries, omit-only is paired with unconditional or absent providers.
- `Result<T>` and `EngineError` (29 variants) in `src/engine/result.ts`. `errorMessage` is a total switch.
- New `as` casts in iter-12+: image export, MiniTransitionSVG slot click, App.tsx Extract narrowing.
- `Snapshot.description: string` design and the `format.ts` serialization-boundary spread-conditional.
- `ExportOptions`, `CommandBarAppMode` extension, edge overlay discriminated-union exhaustiveness.

## Findings (load-bearing)

1. **F8 position — exactOptionalPropertyTypes policy.** Codebase rule is principled per-site but undocumented. Promoting to a new knowledge file `optional-prop-policy.md`. Recommend cleaning up `viewportInset?: ViewportInset | undefined` in `AutomatonCanvas.tsx` line 142 and `useCanvasViewport.ts` line 104 — callsites never produce undefined; widening is dead. Low-severity follow-through.

2. **Dead cast in `imageExport.ts`** (`src/lib/imageExport.ts:82`). `(liveContentGroup as SVGGraphicsElement).getBBox()` — `liveContentGroup` is already `SVGGElement`, which extends `SVGGraphicsElement`. Cast can be removed. Low severity.

3. **Model-mismatch casts in `MiniTransitionSVG.tsx`** (lines 59, 62). `event.currentTarget as unknown as HTMLElement` papers over an SVG element being passed to a callback typed `HTMLElement`. The consumer (`TransitionCreator.openPickerForSlot`) only calls `getBoundingClientRect()`, available on `Element`. Fix: widen the callback signature to `anchor: Element` (or `HTMLElement | SVGElement`). Removes both `as unknown as` casts and a wrong annotation in one change. Same flavor as the `AutomatonLike` casts (since-deleted) — internal model mismatch papered over with `as unknown as`. Medium severity.

4. **`CanvasZoomControls.test.tsx` 7 TS errors.** The fixture `defaultProps()` was not updated when the component grew required `centerToContent` and `isCentered` props (commit `a611034`). Required-prop signal worked correctly; the fixture just needs to add those two functions/values. QA's fix to make. High severity in that it's the entire failing-tsc surface.

## Findings (informational)

- **`Snapshot.description: string` in-memory + `?: string` on disk** is the correct split. Different consumers want different shapes; the serialization boundary at `useFileSession.ts:122` does a clean spread-conditional conversion. No action.
- **`CommandBarAppMode` extension to 'DEFINING'**: no `switch` statements over `appMode` in the codebase — every consumer uses equality checks. No exhaustiveness regression. Acceptable but noteworthy: a future `switch` over `appMode` should include a `default: const _x: never = mode` arm.
- **Wheel-event cast in `AutomatonCanvas.tsx`** (the iter-12 follow-through I queued): now well-commented at lines 354-358. Resolved.

## What I deliberately did not check

- `parseSymbolInput` error path UX trace (queued as iter-13 follow-through in prior journal). Still queued.
- `AutomatonLike` — verified deleted at iter-12 (`5d496ee`); per orchestrator instruction, no further mention.
- Test coverage gaps — qa-reviewer's domain.
- Animation / motion semantics — out of scope for type sweep.

## Memory updates produced

- New knowledge file: `optional-prop-policy.md` (F8 position).
- `strict-flags.md` updated: `exactOptionalPropertyTypes` moved to enabled list with cross-reference to the policy file. Closes audit-002 F3.
- `discriminated-unions.md` updated: Result<T> moved to past tense. Closes audit-002 F4.
- `_index.md` updated: added the new optional-prop-policy entry.
- This journal entry.

## Outcome

Approved. Audit-002 F3, F4, F8 closed. Three small follow-throughs queued: (a) remove `liveContentGroup as SVGGraphicsElement` dead cast, (b) widen `MiniTransitionSVG.onSlotClick` anchor type to `Element`, (c) update `CanvasZoomControls.test.tsx` fixture (QA owns). The prior queue items (parseSymbolInput UX trace) remain queued.
