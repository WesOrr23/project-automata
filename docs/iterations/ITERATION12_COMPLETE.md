# Iteration 12 — UI Polish + Canvas Viewport (Complete)

## What shipped

Five visible threads of change plus one architectural cleanup:

1. **Canvas zoom + pan.** A new `useCanvasViewport` hook owns `{scale, panX, panY}`. Pan via drag (when not on a state node or transition edge); zoom via the `+`/`−`/fit/`1:1` button stack at bottom-right, via keyboard (`+`/`−`/`0`/`f`), or via trackpad (pinch = `wheel + ctrlKey` zooms toward the cursor; two-finger scroll pans). Button-driven changes ease over 300ms; input-driven changes are snappy. The canvas auto-centers on first mount when sizes become known.

2. **Tool menu animation rewrite (Framer Motion).** The open and close are now a literal mirror: vertical expansion (0.45s) → width grow (0.3s) → corner radius (0.3s) on open; reversed on close, with chrome fading during the width-shrink stage. Adopted the `motion` package; CSS keyframes still own breathing/pulse. The collapse button now animates back through EXPANDED rather than jumping to COLLAPSED.

3. **AutomatonLike consolidation (Proposal #1 from iter-9+10 debate).** The structural shadow type is gone. `computePreview` lives in `src/engine/preview.ts`, takes primitive inputs (no `CreationState` import), returns `{ automaton, overlays }` where `EdgeOverlay = { from, to, symbol, kind: 'add'|'modify'|'delete', oldSymbol? }`. The transition editor consumes the engine result directly.

4. **Cursor flicker fix.** Root cause: `user-select: none` on `body` was perturbing cursor inheritance during compositing recalc on `filter` swaps. Fix: scope `user-select: none` to specific containers (tool menu, canvas, popovers, btn, notification title); add `will-change: filter` and explicit `cursor: pointer` on state-node circles to pre-promote the compositing layer.

5. **Several smaller polish items.**
   - GraphViz layout: invisible phantom→state edges force isolated states to rank ≥ 1, keeping rank 0 reserved for the start arrow (so the start state is always left-most).
   - Undo/redo + ⌘Z gated to EDIT mode (meaningless in TEST/INFO/SIM).
   - Transition-edge hit target widened.
   - Notification toasts + canvas-tip + undo/redo pill all fade in/out via Framer's `<AnimatePresence>` — no more pop-in/pop-out.
   - Active row in the tool menu no longer applies press-scale (it's not clickable in active state).
   - Active row's bottom corners round during close so the chrome doesn't stick around as a stadium fragment.
   - Notification optional fields tightened back to omit-only after `exactOptionalPropertyTypes` adoption.
   - `StatePickerPopover` migrated to `useKeyboardScope` (last keydown holdout).

Test count: **290+ → 323**. All green. `tsc` clean.

---

## Phase log

| Phase | Commits | Notes |
|---|---|---|
| AutomatonLike consolidation | `48cc177`, `5d496ee` | preview.ts + delete shadow |
| Tool menu Framer rewrite | `1f98586`, `018d946`, `a46e95a`, `24b7593`, `0e3455c`, `6b90e34`, `7f8efeb`, `54e14e4` | Iterative shaping with user as spec |
| Polish (UI thread) | `b5f6d83`, `aa14b85`, `287f772`, `52883ce` | Non-selectable text + fades + active-row + edge hitbox |
| Cursor flicker + EXPANDED collapse + GraphViz | `ceb6549` | Scoped user-select; GraphViz invis edges |
| Canvas viewport (hook) | `f68014d` | useCanvasViewport |
| Canvas viewport (UI) | `5f28d22` | AutomatonCanvas wiring + CanvasZoomControls |
| Canvas viewport (tests) | `dfd36c9` | 9 hook tests |
| Canvas viewport (polish) | `4cc31ef`, `0689e50`, `a8f3381` | Smooth easing + CSS transform syntax + 1:1 centers |
| Council | `6c8642c` | architecture-reviewer iter-12 type-bloat audit |

---

## Design decisions

### Framer Motion adoption

Three CSS-only options were considered: `@starting-style` + `transition-behavior: allow-discrete`, multi-property keyframes, or sequenced `transitionend` listeners. None composed cleanly for "open mirrors close" with three staged phases and AnimatePresence for delayed unmount. Framer's `motion.div` + `<AnimatePresence>` directly model the requirements: per-property `transition.delay`, exit animations, and presence-aware unmount. CSS keyframes still own breathing/pulse — those are continuous loops, not state transitions, and don't benefit from the JS layer.

### Why three staged phases for tool menu close

Closing in one motion looked like a card collapsing from all sides simultaneously — visually muddy. Staging it as vertical → width → radius reads as "first the content folds away, then the card narrows, then the silhouette settles." Each stage is short (≤450ms), so the total close is ~700ms — long enough to read as deliberate, short enough to never feel sluggish.

### Pan delta is negated for "natural" trackpad direction

Two-finger scroll on macOS is content-direction (drag content the way your fingers move). Wheel deltas come in as scroll-direction (positive = page-down). The handler negates both deltaX and deltaY so two-finger up moves the canvas content up — matching what users expect from Maps/Figma/etc.

### Anchor-stable zoom

`useCanvasViewport.handlers.onWheel` (with `ctrlKey`) computes the world point under the cursor, applies the scale change, and back-solves a new `panX`/`panY` so the same world point still sits under the cursor after the zoom. Same math as Figma. Tested with `worldX/Y before == worldX/Y after` invariants.

### Why `1:1` centers content (not pan-zero)

Initial design had `1:1` reset pan to (0,0). Felt arbitrary — it just put the content in the top-left corner. New behavior: `1:1` reverts scale to 1 and centers content in the viewport. Matches the auto-center behavior on initial mount, so `1:1` reads as "give me the starting state back."

### Cursor flicker — root cause was body-level user-select

The original suspect was the compositing-layer recalc on `filter` swap during `:hover`. Adding `will-change: filter` helped a little but didn't fully fix it. Final fix turned out to be subtler: `user-select: none` on `body` was triggering a chrome (browser-level, not project-level) pass that briefly lost the cursor during state-node hover. Scoping the rule to specific containers and dropping it from `body` resolved it. The `will-change: filter` + explicit child-cursor declarations remain as defense-in-depth.

### EXPANDED-as-collapse-target

Originally, the `Collapse` button took the menu from OPEN → COLLAPSED in one step. Bug: if the user moved the mouse fast enough mid-animation, the menu would briefly hover-expand back to EXPANDED, then snap to COLLAPSED — visual glitch. New behavior: `Collapse` always goes through EXPANDED; the user can collapse further by clicking elsewhere. Reads as a deliberate two-step.

### GraphViz left-most start state

DOT's `rankdir=LR` puts source nodes on the left, but isolated states (those with no incoming edges) can land at rank 0 alongside the start state. Fix: for every state with no incoming real transition, add an invisible `phantom→state` edge. Forces all isolated states to rank ≥ 1, keeping rank 0 reserved for the start arrow's source.

---

## What stayed the same

- All engine semantics.
- All keyboard shortcuts (added `+`/`−`/`0`/`f`; existing ones unchanged).
- The simulation visual language (pulse-edge-fired, pulse-die, accept/reject coloring) untouched.
- Existing notifications behavior — only the entry/exit got fades.

---

## Out of scope / deferred (now iter-14 backlog)

- **Full viewport clamping.** Pan currently keeps ≥80px of content visible — basic safety, but at high zoom the user can still pan content most of the way out. Need a stricter clamp.
- **State-actions popover positioning at zoomed scale.** Anchors to screen coords of the underlying state; drifts when scale ≠ 1.
- **Notification highlight at zoomed scale.** Same issue — the highlighted node's position is computed in pre-transform world coords.
- **Active-row element-swap smoothness.** When the active tab changes, the new row's chrome flashes briefly before layout settles.
- **Reduced-motion media query** — still deferred from iter-10.

## Out of scope / future

- AutomatonLike was the last Proposal-tier item. The remaining "if it shows up" cleanups (test-utils extraction, `useUndoableAutomaton` discriminated reducer) are captured in iter-13's audit-cleanup plan.

---

## How to run

```bash
cd /Users/wesorr/Documents/Projects/Project\ Automata/.claude/worktrees/iter-12
npm test -- --run            # 323 passing
npx tsc --noEmit             # clean
npm run dev                  # browser at http://localhost:5174
```

Browser checks for the iter-12 work specifically:
1. **Tool menu** — open and close, verify they mirror.
2. **Canvas** — drag-pan the empty area; pinch-zoom (trackpad); use the `+`/`−`/fit/`1:1` buttons; press `+`/`−`/`0`/`f`.
3. **Hover** — state nodes shouldn't flicker the cursor.
4. **GraphViz** — start state should always be left-most.
5. **EDIT-mode gating** — switch tabs, confirm undo/redo + ⌘Z don't fire outside EDIT.
