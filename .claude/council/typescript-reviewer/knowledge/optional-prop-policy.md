---
agent: typescript-reviewer
type: knowledge
topic: optional-prop-policy
schema-version: 1
verified-as-of: 369cd14
last-updated: 2026-04-27
confidence: high
---

# Optional Prop Policy under `exactOptionalPropertyTypes`

## Principle

`exactOptionalPropertyTypes` (enabled in iter-11, commit `3607000`) distinguishes two distinct shapes:

- `field?: T` — the field MAY be omitted; `undefined` is NOT an acceptable value. Passing `undefined` explicitly is a type error.
- `field?: T | undefined` — the field MAY be omitted OR explicitly `undefined`. The two are interchangeable.

The flag forces an honest decision per field. The codebase has settled on a rule based on the **shape of the producer**, not on field semantics.

## The rule

| Producer shape                                                                | Use                          |
| ----------------------------------------------------------------------------- | ---------------------------- |
| Callsite uses a ternary that may yield `undefined` (e.g., `cond ? x : undefined`) | `?: T \| undefined` (widen) |
| Callsite always provides a real value, or doesn't pass the prop at all        | `?: T` (omit-only)           |
| Producer controls whether the key is present                                  | `?: T` + spread-conditional  |

The third row is the canonical case for serialization, overlay metadata, and any data structure where "absent" carries semantic meaning distinct from "empty/zero/null."

## Examples in the codebase

### Widened (`?: T | undefined`) — appropriate

`AutomatonCanvas` sim-state props (`activeStateIds`, `nextTransitions`, `firedTransitions`, `dyingStateIds`, `simulationStepIndex`, `onStateClick`, `onEdgeClick`, etc.). The callsite in `App.tsx` threads `appMode === 'SIMULATING' ? sim.foo : undefined` for each. The explicit-undefined branch is load-bearing — without widening, the ternary would not type-check. Verified at the `<AutomatonCanvas>` block in `src/App.tsx`.

`Notification.detail`, `Notification.target`, `NotifyInput.autoDismissMs` in `src/notifications/types.ts` — same pattern, callsites pass computed values that may be `undefined`.

### Omit-only (`?: T`) — appropriate

`onShowTour`, `onSvgRefChange`, `onExportPNG`, `onExportSVG`, `focusSignal`, `transparent` (`ExportOptions`). Each callsite either provides a real value unconditionally or omits the prop entirely. No ternary produces `undefined` for these.

### Spread-conditional — appropriate

`EdgeOverlay.oldSymbol?: string` in `src/engine/preview.ts`. Producer: `...(oldSymbol !== null && { oldSymbol })` in the symbol-modify branch. Absence vs presence is meaningful (purple-edge label rendering depends on it).

`AutomataFileMetadata.description?: string` in `src/files/format.ts`. Producer at `parseAutomataFile` line 110: `...(meta.description !== undefined ? { description: meta.description } : {})`. On-disk format omits the key when there's no description; in-memory the value is collapsed to `''` for simpler form binding. The boundary at `useFileSession.ts:122` does the conversion.

## Anti-patterns

- **`field?: T | undefined` when no callsite ever produces undefined.** The widening is dead — convert to `?: T`. Found at `viewportInset?: ViewportInset | undefined` in `AutomatonCanvas.tsx` and `useCanvasViewport.ts`: callsites always pass a real object. Recommended cleanup, low severity.
- **`?: T` (omit-only) when the callsite uses a `cond ? x : undefined` ternary.** TypeScript will error; the fix is either widen the type or change the callsite to spread-conditional / omit-via-ternary (e.g., move the conditional to wrap the JSX prop).
- **Reflexive `field ?? undefined` shims to silence the flag.** The flag exists to force the decision; shimming defeats the purpose. None found in the codebase at iter-19 HEAD.

## What to look for in diffs

- New `?: T | undefined` props: confirm at least one callsite produces an explicit `undefined`. If none does, narrow to `?: T`.
- New `?: T` props: confirm no callsite uses a ternary producing `undefined`. If one does, either widen or move the conditional to wrap the prop.
- New optional fields in serialization types: should be `?: T` with spread-conditional at the producer.
- `field ?? undefined` patterns: red flag, the flag is being defeated.

## Provenance

Pattern observed across iter-11 (commit `3607000`), iter-12, and iter-13–iter-19 component additions. Audit-002 finding F8 raised the question of whether the widening was reflexive or principled; close review showed the architect's iter-11 close-out commit message articulated the per-site reasoning, but no knowledge file captured the rule. This file does. Verified at HEAD `369cd14`.
