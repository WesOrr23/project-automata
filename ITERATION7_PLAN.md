# Iteration 7 — Visual Transition Editor

## Why this iteration exists

Iteration 6 built a tabular transition editor in the sidebar. Despite multiple rewrites (table → CSS-Grid, sticky → fade overlays, popovers → roving focus), it never stopped fighting the fundamental constraint that a transition matrix wants width but a sidebar gives ~250px.

This iteration replaces that approach with a **visual creation form** — a small SVG preview of "the transition you're building" plus two paths to fill in source/destination: pop-up state list, or click-on-canvas. The canvas itself becomes the home for inspecting and deleting existing transitions.

---

## The form

A small section in the Edit tab below States:

```
┌─────────────────────────────────────┐
│  TRANSITIONS                        │
│                                     │
│      ┌───┐         ┌───┐            │
│      │ ? │ ──────▶│ ? │            │  ← mini SVG preview
│      └───┘         └───┘            │
│                                     │
│  Symbol: [   ]                      │  ← textbox
│                                     │
│  [        Pick source        ]      │  ← progressive Add button
└─────────────────────────────────────┘
```

The SVG circles, symbol field, and Add button are all interactive. The user can fill them in any order; the Add button reflects what's missing.

---

## State machine

```typescript
type CreationState =
  | { phase: 'idle';                source: null;   destination: null;   symbol: '' }
  | { phase: 'picking-source';      source: null;   destination: null;   symbol: string }
  | { phase: 'picking-destination'; source: number; destination: null;   symbol: string }
  | { phase: 'awaiting-symbol';     source: number; destination: number; symbol: string }
  | { phase: 'ready';               source: number; destination: number; symbol: string }; // symbol non-empty
```

Transitions:
- `idle` → `picking-source` on click of source circle / Add button when nothing filled
- `picking-source` → `picking-destination` on state pick (canvas click or popup)
- `picking-destination` → `awaiting-symbol` on state pick
- `awaiting-symbol` → `ready` on symbol typed
- `ready` → commit + back to `idle` on Add or Enter
- any → `idle` on Escape

Implemented as a `useReducer` for testability.

### Add button text by phase

| Phase | Button label |
|---|---|
| `idle` | "Pick source" |
| `picking-source` | "Pick source" (disabled — waiting for canvas/popup) |
| `picking-destination` | "Pick destination" (disabled) |
| `awaiting-symbol` | "Type a symbol" (disabled) |
| `ready` | "Add transition" |

---

## Mini SVG component

Two circles with a curved arrow between them. Self-loop variant when source === destination.

States of each circle:
- **Empty + idle**: gray outline, "?" inside
- **Empty + active picking**: blue pulsing ring, "?" inside
- **Filled**: state's display label (e.g. "q0")

Each circle is clickable — clicking opens the existing custom popover (the one we built for the table cells, lifted into a reusable component) anchored to the right of the menu, listing all states.

---

## Two input paths

### Path 1 — Popup mode (Phase 1)
Click a circle in the mini SVG → custom popover opens to the right of the menu → pick a state. The picked state's label fills the circle. State machine advances.

### Path 2 — Canvas mode (Phase 2)
When the form is in `picking-source` or `picking-destination`, the canvas enters "pick a state" mode:
- Cursor changes to pointer over state nodes
- Hovering a state shows an outline
- A status line below the form reads "Click a state on the canvas..."

Clicking a state on the canvas advances the state machine just like the popup pick.

The two paths are interchangeable — user can pick source via popup, destination via canvas, or any mix.

---

## Editing existing transitions

**Canvas-only.** No list in the sidebar.

Click an existing edge on the canvas → the mini SVG fills with that transition's source/destination/symbol → the form enters a "selected existing" state with a Delete button replacing Add.

This subsumes the entire transition listing concern: the canvas is the list.

---

## Self-loop case

When source === destination, the mini SVG morphs from "two circles + arrow" to "one circle with self-loop arrow." Same component, different rendering branch.

---

## Phasing

### Phase 1 — Form + state machine + popup mode
- Reducer + tests
- `MiniTransitionSVG` component (two circles, no self-loop yet)
- `TransitionCreator` component composing SVG + symbol input + progressive Add button
- Reuse the existing custom popover (extract from TransitionCell into a reusable component)
- Replace the entire current TransitionEditor with the new TransitionCreator
- **Temporary**: a minimal one-line-per-transition list with delete buttons remains under the creator form so users can still delete during Phase 1-2. Removed in Phase 3.

### Phase 2 — Canvas click for state picking
- AutomatonCanvas accepts a `pickMode` prop ('none' | 'state')
- When `pickMode === 'state'`, state nodes get hover/cursor affordance and click handlers
- App wires the form's state machine: `picking-*` phases set `pickMode='state'`
- Status text below the form during picking phases

### Phase 3 — Canvas-click on existing edge
- TransitionEdge components become clickable (even when not in pick mode)
- Click loads the edge into the mini SVG; form enters "editing existing" state
- Add button becomes Delete button
- Remove the temporary transition list from Phase 1

### Phase 4 — Polish
- Self-loop visualization in mini SVG
- Escape key handling (returns state machine to idle)
- Status text refinement
- Notification for invalid attempts (duplicate transition, etc.)
- Visual reinforcement on canvas (subtle pulse on state nodes during picking)

---

## Files

### New
- `src/components/transitionEditor/TransitionCreator.tsx`
- `src/components/transitionEditor/MiniTransitionSVG.tsx`
- `src/components/transitionEditor/creationReducer.ts`
- `src/components/transitionEditor/creationReducer.test.ts`
- `src/components/popover/Popover.tsx` (extracted reusable popover)

### Modified
- `src/components/toolMenu/EditPanel.tsx` — uses TransitionCreator instead of TransitionEditor
- `src/App.tsx` — wires the new form (uses existing handleSetTransition)
- `src/components/AutomatonCanvas.tsx` — accepts pickMode, click handlers (Phase 2+)
- `src/components/StateNode.tsx` — pick-mode affordance (Phase 2)
- `src/components/TransitionEdge.tsx` — click-to-edit (Phase 3)
- `src/index.css` — styles for new form

### Removed (Phase 3)
- `src/components/toolMenu/TransitionEditor.tsx`
- `src/components/toolMenu/TransitionGrid.tsx`
- `src/components/toolMenu/TransitionCell.tsx`
- `.transition-grid-*` CSS rules

---

## Verification

After each phase:
- `npm test -- --run`: all passing (engine + new reducer tests)
- Manual: build a 4-state DFA from scratch end-to-end using only the new form

End-to-end test for Phase 4:
1. Click source circle → popup opens → pick q0 → SVG fills
2. Click destination circle on canvas (Phase 2) → q1 fills
3. Type "0" in symbol box → Add button enables
4. Click Add → transition appears on canvas, form resets
5. Click the new edge on canvas → form populates with that transition → Delete → transition gone
