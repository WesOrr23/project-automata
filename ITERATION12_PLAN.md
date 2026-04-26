# Iteration 12 — UI Polish + Canvas Viewport (Plan)

> **Note:** Written retrospectively. Iter-12 was a UI polish iteration plus the long-deferred AutomatonLike consolidation (Proposal #1 from the iter-9+10 council debate) and a new feature: canvas zoom + pan.

## Context

After iter-11 closed the architectural backlog, three threads of UI rough-edges had accumulated:

1. The tool menu's open/close animation didn't read as one motion. CSS transitions on multiple properties were firing independently and the close looked nothing like the open.
2. The canvas was a fixed-size SVG. On dense automatons, content fell off the edges; on sparse ones, the visible region was mostly empty.
3. Cursor flicker on hover of state nodes — pointer briefly reverted to default during compositing-layer recalc.

Plus the **AutomatonLike consolidation** (Proposal #1) was still outstanding. The architecture-reviewer and typescript-reviewer disagreed on the right shape; the user wanted to mediate that personally before any code moved.

## Goals

1. **AutomatonLike consolidation** — implement the user-approved shape (Proposal #1: move preview math to `src/engine/preview.ts` with `EdgeOverlay` sidecar; delete the structural-shadow generic).
2. **Tool menu animation rewrite** — adopt Framer Motion (`motion` package) and structure the close as a literal mirror of the open, in three staged phases.
3. **Canvas zoom + pan** — full viewport: pan via drag, zoom via buttons (`+`/`−`/fit/`1:1`) and trackpad (pinch + two-finger scroll). Keyboard shortcuts. Eased on button-driven changes; snappy on input-driven ones.
4. **Cursor flicker fix** — root-cause and patch.
5. **GraphViz layout** — ensure the start state always lays out left-most (was sometimes mid-graph).
6. **Undo/redo + ⌘Z gated to EDIT mode** — they're meaningless in TEST/INFO/SIM tabs.
7. **Several smaller polish items** — wider transition-edge hitbox, smooth tab swap, fading toasts, app-wide non-selectable chrome text.

## Non-goals

- Any engine semantics change.
- Any new product feature beyond zoom/pan.
- Reduced-motion media query (still deferred from iter-10).

## Phase order

1. Land AutomatonLike consolidation (extract `computePreview` to engine, delete shadow type).
2. Tool menu Framer Motion rewrite — multiple iterative passes; the user is the spec.
3. Cursor-flicker investigation + scoped `user-select` fix.
4. Canvas viewport hook (`useCanvasViewport`) — state + math + handlers, no rendering yet.
5. Wire viewport into `AutomatonCanvas` (transform on the content `<g>`).
6. `CanvasZoomControls` component (4 buttons, bottom-right).
7. Smooth easing for button-driven zoom (transition class, 300ms).
8. GraphViz left-most start state via invisible phantom edges.
9. Undo/redo + ⌘Z EDIT-mode gating.
10. Transition-edge widened hit target.
11. Notification + canvas-tip + undo/redo fade-in/out.
12. Initial-center pass; `1:1` button centers (not pan-zero).
13. Unit tests for `useCanvasViewport`.

## Success criteria

- Tool menu open ⇄ close visibly mirror each other.
- Canvas content can be panned and zoomed; pan clamped so ≥80px stays visible (basic safety, not full clamping — that's iter-14).
- Wheel + ctrlKey zooms toward cursor; wheel without ctrlKey pans.
- Buttons + keyboard shortcuts (`+`/`−`/`0`/`f`) work.
- ⌘/Ctrl+Z bound only when in EDIT mode.
- 290 → 320+ tests passing.

## Risks

- **Framer Motion adoption.** New dependency; per-component animation logic moves from CSS to JS. Mitigation: keep CSS keyframes for breathing/pulse (no replacement needed); only adopt motion where staged sequencing matters.
- **Viewport math correctness.** Anchor-stable zoom is easy to get subtly wrong. Mitigation: unit tests with explicit world-point invariants.
- **GraphViz left-most start.** Invisible phantom edges to every isolated state could distort layout. Mitigation: only add them where they don't already have an incoming real edge.

## Out of scope / future

- **Full viewport clamping** — preventing content from being panned outside the visible region entirely. Deferred to iter-14.
- **State-actions popover positioning at zoomed scale** — currently anchors to screen pixels of the underlying state, which drifts at non-1× scale. Iter-14.
- **Notification highlight at zoomed scale** — same issue.
- **Active-row element-swap smoothness** — when the active tab changes, the new row's chrome flashes briefly before the layout settles. Iter-14.
