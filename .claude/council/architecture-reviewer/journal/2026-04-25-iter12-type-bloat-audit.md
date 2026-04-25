---
agent: architecture-reviewer
type: journal
iteration: 12
date: 2026-04-25
diff-hash: null
duration-ms: null
schema-version: 1
---

# Iter-12 type-bloat audit — full type-system sweep

## Brief received

Wes asked: "are any of our types unnecessary? Why can't the preview automaton just be a normal automaton? Why can't they be combined?" Cited `AutomatonLike`/`EdgePreview` in `creationReducer.ts` as the trigger but wants a broader sweep. This audit also unblocks the gated `automaton-like-pending-user-review` open question.

Read-only review. No source modifications.

## My assessment

REVISION RECOMMENDED on three structural-shadow types in `creationReducer.ts`. Everything else is pulling its weight. The codebase is, on the whole, lean — most types either name a real domain concept, narrow a discriminated union, or document a component's API. The bloat is concentrated in one file.

---

## Type inventory

### Engine — `src/engine/types.ts`

| Type | Verdict | Notes |
|---|---|---|
| `Transition` | **Keep** | Core domain. `to: Set<number>` carries NFA-compatibility; cannot collapse. |
| `Automaton` | **Keep** | Core domain. Every field earns its place. |
| `SimulationStep` | **Keep** | Per-step record drives the canvas's red-fade and edge-pulse animations. The `firedTransitions` inline shape `{ from; to; symbol }` is simulation-output-flavored (single dest, post-flatten) and intentionally distinct from `Transition` — see "things not to touch." |
| `Simulation` | **Keep** | Holds running state distinct from the per-step record. |

### Engine — `src/engine/result.ts`

| Type | Verdict | Notes |
|---|---|---|
| `EngineError` | **Keep** | String-literal union — exhaustive switch, typo-proof. Documented in `result-type-error-model.md`. |
| `Result<T>` | **Keep** | Idiomatic discriminated union. Replaces double-call dance. |

### UI state — `src/ui-state/types.ts`

| Type | Verdict | Notes |
|---|---|---|
| `StateUI` | **Keep** | Position + label keyed by foreign-key state ID. Engine-UI boundary. |
| `TransitionUI` | **Keep** | Carries GraphViz output (spline, arrowhead, label position). Cannot be collapsed into `Transition` — different layer, different concerns, consolidation field (`symbols[]`) is post-engine work. |
| `AutomatonUI` | **Keep** | Mirrors engine `Automaton` for rendering; explicitly documented as parallel by design. |

### Notifications — `src/notifications/types.ts`

| Type | Verdict | Notes |
|---|---|---|
| `NotificationSeverity` | **Keep** | 4-variant union, drives default dismiss timings + colors. |
| `NotificationTarget` | **Keep** | Discriminated union — state / transition / alphabet symbol have genuinely different shapes. Tag is load-bearing. |
| `Notification` | **Keep** | Stored shape (with `id`, `createdAt`). |
| `NotifyInput` | **Watch** | Input shape that omits store-supplied fields. Tiny duplication with `Notification` (severity, title, detail, target, autoDismissMs). Could be `Omit<Notification, 'id' \| 'createdAt'> & { autoDismissMs?: ... }`. Net savings: ~4 lines, no semantic change. Low impact — flag, don't push. |

### Hooks — `src/hooks/`

| Type | Verdict | Notes |
|---|---|---|
| `Snapshot` | **Keep** | Folds automaton + ε-symbol so one undo = one user-visible restoration. |
| `UseUndoableAutomatonResult` | **Keep** | Documents the hook's surface; consumed by `App.tsx`. |
| `KeyHandler`, `KeyboardScopeOptions`, `RegisteredScope` | **Keep** | Documented in `keyboard-scope-stack.md`. |
| `SimulationStatus`, `SimulationState`, `SimulationAction` | **Keep** | Reducer triad — standard pattern, all three earn keep. |
| `UseAutomatonSimulationGlueOptions`, `UseAutomatonLayoutResult`, `UseUndoRedoShortcutsOptions` | **Keep** | Hook API surfaces. Per-hook one type each is appropriate. |

### Components — props

Every component has its own `XxxProp` type. This is documented as `granular-prop-convention.md`. Reviewed for whether any are gratuitous: **none are.** Each lists primitives (no `Automaton` prop drilling), each documents what its component consumes. The convention is earning its keep — primarily because the prop types double as the component's API documentation.

### Tool menu — `src/components/toolMenu/types.ts`

| Type | Verdict | Notes |
|---|---|---|
| `ToolTabID` | **Keep** | 3-variant string union; used by `ToolMenuState`. |
| `ToolMenuState` | **Keep** | Discriminated union — COLLAPSED / EXPANDED / OPEN. The `OPEN` variant is the only one that needs `activeTab`; collapsing to a flat `{ mode, activeTab? }` would re-admit invalid states. |
| `ToolTab` | **Keep** | Tab metadata record. Companion `toolTabs` constant is fine. |

### Transition editor — `src/components/transitionEditor/creationReducer.ts`

| Type | Verdict | Notes |
|---|---|---|
| `CreationPhase` | **Keep** | Drives picking affordances. |
| `CreationState` | **Keep** | Reducer state. |
| `CreationAction` | **Keep** | Discriminated union of dispatchable actions. Standard reducer pattern. |
| `ParsedSymbols` | **Keep** | Local Result-shaped pair. Could in principle reuse `Result<Array<string \| null>>` from engine but its error variant is `string[]` (multi-error), not `EngineError`, and its consumers are UI-only. Watching, but not advocating consolidation. |
| `ActionMode` | **Keep** | 3-variant union for action button state. |
| `EdgePreview` | **Eliminate (proposal #1)** | Sidecar overlay that mirrors `Transition` shape with extra `kind` + `oldSymbol`. Structural shadow. |
| `TransitionLike` | **Eliminate (proposal #1)** | Local structural-shadow of `Transition` to avoid engine import. Costs a cast. |
| `AutomatonLike<T>` | **Eliminate (proposal #1)** | Generic shadow of `Automaton`. Single concrete caller, two internal `as unknown as T` casts, one external cast in `App.tsx`. Already gated as a known crack. |

### `src/ui-state/utils.ts` (boundary internals)

| Type | Verdict | Notes |
|---|---|---|
| `ParsedEdgePos`, `GraphvizNode`, `GraphvizEdge`, `GraphvizJson` | **Keep** | All `file-private` (not exported). They live inside the GraphViz boundary module, which is the documented location for these (`external-dependency-boundary.md`). Removing them would mean using `any` against GraphViz output — strictly worse. |

---

## Proposal #1 — Eliminate `AutomatonLike` / `TransitionLike` / `EdgePreview` ; preview is a real `Automaton` with a sidecar overlay

### What it would look like

`computePreview` moves to `src/engine/preview.ts` and returns a real `Automaton` plus an overlay map keyed by `(from, to, symbol)`:

```ts
// src/engine/preview.ts

export type EdgeOverlayKind = 'add' | 'modify' | 'delete';

export type EdgeOverlay = {
  // Same identifying triple as a Transition's wire-shape, but
  // intentionally singular `to: number` because overlays target one
  // visual destination at a time. NOT a shadow of Transition — a
  // sidecar keyed BY transition coordinates.
  from: number;
  to: number;
  symbol: string | null;
  kind: EdgeOverlayKind;
  oldSymbol?: string;
};

export function computePreview(
  automaton: Automaton,
  state: CreationState,
  mode: ActionMode,
  parsed: ParsedSymbols,
  isNFA: boolean
): { automaton: Automaton; overlays: EdgeOverlay[] };
```

The internal logic stays — but speculative transitions become real `Transition` objects (they already are in shape; only the casts change). The "transitions to lay out" become a real `Automaton` constructed with `{ ...automaton, transitions: [...] }`. GraphViz layout already consumes `Automaton`; the call site in `App.tsx` (lines 149–152) literally already wraps the result back into an Automaton. That wrapping moves into `computePreview` itself.

### Cost

- **Files affected**: `creationReducer.ts` (delete 3 types, move computePreview out), `App.tsx` (collapse the post-call rewrap), `AutomatonCanvas.tsx` (rename `EdgePreview` → `EdgeOverlay` import, prop name unchanged or renamed), `TransitionEdge.tsx` (same import rename), test file (rename type imports).
- **Casts removed**: 3 (`as unknown as T` ×2 in computePreview, `as Automaton['transitions']` in App.tsx wrapper).
- **Lines net**: roughly −15 (delete two types and a generic, simpler signature, no rewrap at callsite).
- **Engine boundary impact**: `computePreview` moves into `src/engine/`. It's pure logic on engine data — already engine-shaped. Resolves the documented engine/UI separation crack.
- **`ParsedSymbols` and `CreationState` import**: those would need to either move with `computePreview` to engine, or the engine function signature would take primitives instead. Pragmatic fix: keep `parseSymbolInput` + the *inputs* it produces (`Array<string | null>`) at the UI layer, and have engine `computePreview` take `(automaton, sourceId, destId, symbols, mode, editingExisting, isNFA)` as raw values. That avoids dragging UI types into engine.

### Risk

- Low. The shape transformation is mechanical. Test coverage exists (`creationReducer.test.ts` has the conflict-branch tests). Signature widens slightly because `computePreview` would take 7 primitive args instead of 5 mixed args; can wrap in a helper if it's noisy at the callsite.
- One thing to watch: `EdgeOverlay` keying is `(from, to: number, symbol)`. Engine `Transition.to` is `Set<number>`. The overlay is intentionally singular — it targets a *visual* edge (post-consolidation, post-NFA-flatten). That's the same as `EdgePreview`'s `to: number` today. No regression.

### Why it's a win

1. Resolves the long-standing documented "one known crack" in engine/UI separation.
2. Removes 3 casts and 2 types.
3. Answers Wes's question directly: yes, the preview *can* be a normal Automaton. The overlay info that *isn't* automaton-shaped (the kind/oldSymbol) lives in a sidecar. The two were tangled because `EdgePreview` smushed engine data with UI overlay metadata into one struct.
4. The structural-shadow generic was the price of keeping `computePreview` in the UI layer to avoid an engine import. Once you accept that this is engine logic, the shadow disappears.

---

## Proposal #2 — `NotifyInput` derive from `Notification` (low priority)

### What it would look like

```ts
export type NotifyInput = Omit<Notification, 'id' | 'createdAt' | 'autoDismissMs'> & {
  autoDismissMs?: number | null;
};
```

### Cost

Trivial — single file, ~4 lines saved, no semantic change.

### Risk

Negligible.

### Why it's a win

Removes a small structural duplication. **But:** this is the kind of "code-golf" change Wes's audit isn't really about. Mention it; let him decide. I would not push for it.

---

## Things I want to NOT touch and why

- **`Transition` vs. `TransitionUI` vs. `firedTransitions[]` inline shape.** Three transition-flavored shapes that look duplicative but each represents a different point in the data flow:
  - `Transition` is the *engine* shape (`to: Set<number>` for NFA branching).
  - `TransitionUI` is the *post-layout* shape — consolidates multiple symbols on the same `(from, to)` into one rendered edge with `symbols: ReadonlyArray`, plus carries spline geometry.
  - `SimulationStep.firedTransitions[]` is the *runtime* shape — a flat `{from, to, symbol}` because at execution time we have already chosen which destination fired.
  These are three different layers with three different concerns. Collapsing them would require carrying conditional fields and would make every consumer branch on shape. **Keep them all.**

- **`Automaton` vs. `AutomatonUI`.** Same reasoning. UI metadata genuinely doesn't belong in the engine type. The current split is what makes the engine testable in isolation. The canvas, simulator, and editor all consume different projections.

- **The `XxxProp` per-component convention.** It is verbose at first glance, but each `XxxProp` doubles as the component's API documentation and forces the granular-prop convention (no `Automaton` prop-drilling) that this project has explicitly chosen. Don't trim them.

- **`ToolMenuState` discriminated union.** `OPEN` carrying `activeTab` while `COLLAPSED`/`EXPANDED` don't is exactly the kind of state-machine modeling the union is for.

- **`SimulationAction`, `CreationAction` reducer unions.** Standard pattern, all variants are real.

---

## Resolution of `automaton-like-pending-user-review.md`

**Recommendation: approve Proposal #1 above.**

Proposal #1 is the same fix the open question describes ("move `computePreview` to `engine/preview.ts`, kill the generic, delete all three casts"), with one extension: `EdgePreview` *also* moves to engine as `EdgeOverlay`, because the same audit logic applies to it. This audit confirms:

- Single concrete caller (App.tsx).
- 3 casts at HEAD (verified in this audit).
- The structural shadow exists *only* to avoid an engine import; the function it gates is engine-shaped logic.
- Wes's question "why can't preview be a normal automaton?" has no good answer. It can. It should be.

If Wes accepts:
1. The architect's `engine-ui-separation.md` knowledge stays correct (the crack closes; update verified-as-of and remove the "one known crack" sentence).
2. The architect's iter-7/iter-8 historical journal verdict is *withdrawn* — the typescript-reviewer's `generic-constraints.md` cautionary-tale framing was right.
3. Open question moves to `resolved` with resolution `approve-fix`.

If Wes wants to do less: just doing the move (without renaming `EdgePreview` → `EdgeOverlay`) still resolves the open question. The rename is a polish item.

---

## Memory updates produced (proposed — not written)

This journal entry is the deliverable. If Wes approves Proposal #1, two follow-up updates would land *after* the code change:

1. New knowledge file: `structural-shadow-types.md` — pattern to watch for, with `AutomatonLike` as the canonical example.
2. Update `engine-ui-separation.md` — remove "one known crack" paragraph, bump `verified-as-of`.
3. Close `open-questions/automaton-like-pending-user-review.md` with resolution.
4. (Optionally) demote `data-shape-divergence-at-graphviz-boundary.md` open question if this audit's "things not to touch" reasoning resolves it.

I have NOT made any of those edits — per the contradictions-preservation rule in the open-question file, the audit's job is to give Wes the picture, not unilaterally reconcile.

## What I deliberately did not check

- Test impact of moving `computePreview` (qa-reviewer's domain).
- TypeScript-level correctness of the proposed signature widening (typescript-reviewer's domain).
- Whether `parseSymbolInput` belongs in engine alongside `computePreview` (out of scope; it's UI-input parsing).
- CSS, animation, render-perf concerns (out of scope).

## Outcome

Audit complete. One concentrated bloat site identified (`creationReducer.ts`'s structural shadows). Proposal #1 written. Resolution path for the gated open question identified. Awaiting Wes's decision.
