# Iteration 14 — UI Polish + Viewport Clamping (Complete)

## What shipped

The headline change is the cohesive viewport clamp. Two threads:

1. **Viewport clamping ("centered slack" policy).** A new pure helper `clampViewport(viewport, contentBoundingBox, viewportSize)` lives in `src/hooks/useCanvasViewport.ts`. The policy is per-axis: when the scaled content is *smaller than or equal to* the viewport on an axis, content is centered and pan-locked on that axis (no drifting into empty space); when the scaled content is *larger than* the viewport, pan is clamped so the content always fully covers the viewport (no edge can recede past the corresponding viewport edge). The helper replaces the old `clampPan` (which had the "≥80px visible" rule that allowed content to drift mostly off-screen). All five callsites — `panBy`, `zoomIn`, `zoomOut`, the wheel-ctrl zoom, and the wheel-pan branch (via panBy) — now go through `clampViewport`.

2. **Active-row swap smoothness via Framer `layoutId`.** The active row in the tool menu is now wrapped in a `motion.div` with `layoutId="tool-menu-active-row-chrome"`. When the user clicks a different tab, the previous row's chrome unmounts and the new row's chrome mounts; Framer detects the same layoutId and animates the chrome from the old row's position to the new row's position over 250ms instead of an instant swap.

Skipped (Phase 2 of the plan): the `worldToScreen` helper for popover/highlight positioning. On inspection, the popover anchor is computed via `getBoundingClientRect()` on the state node's SVG `<g>`, which already returns post-CSS-transform screen coordinates. The notification highlight is rendered as part of the state node *inside* the transformed `<g>`, so the transform applies automatically. Both are correct at any zoom — no migration needed. If a real positioning bug surfaces during browser verification, this is iter-15+ work.

Tests: **362 → 369** (+7 for `clampViewport`). All green. `tsc --noEmit` clean.

---

## Phase log

| Phase | Touched | Tests added |
|---|---|---|
| 1 — Viewport clamping (helper + 5 call-site migrations + 7 unit tests) | useCanvasViewport.ts + test | +7 |
| 2 — worldToScreen helper | (skipped — see above) | 0 |
| 3 — Active-row Framer layoutId | ToolMenu.tsx | 0 |

---

## Design decisions

### Why "centered slack" over "padded fit" or "strict bounding-box"

The plan named three options. Strict (content fully inside viewport at all times) is painful at high zoom — you can't zoom in to inspect one corner without losing the others. Padded fit (a hardcoded N pixels must remain visible) was the prior behavior and produced exactly the "weird stuff" Wes flagged: at low zoom, you could pan content most of the way out and only see a thin strip; at high zoom, only a tiny corner of content. Centered slack matches the user mental model: "the FA is the world; you scroll *within* it. When the world is smaller than the window, there's nothing to scroll to, so don't let pan drift."

Centered slack also has the nice property that the clamp is reference-stable when nothing changes — `clampViewport` returns the input unchanged when the input is already in-policy, preserving React's render-skipping.

### Why `clampViewport` takes the full viewport (not separate panX/panY/scale)

The old `clampPan(panX, panY, scale, ...)` worked but forced callers to destructure-and-recompose. The new shape `clampViewport(viewport, ...)` lets callers pass through a viewport object built from a recompute and get back another viewport, with the no-op-returns-same-reference invariant. Cleaner data flow; one fewer place for off-by-one bugs.

### Why skip `worldToScreen` for popovers and highlights

The premise of the plan's Phase 2 was that popovers and highlights drift at non-1× zoom because the position is computed in pre-transform world coords. On inspection, that premise was wrong:

- **Popovers** anchor via `getBoundingClientRect()` on the SVG `<g>` element representing the state. `getBoundingClientRect()` returns post-CSS-transform screen pixels — the CSS `transform: translate(panX,panY) scale(scale)` on the parent content `<g>` is reflected in the rect. So the anchor is correct at any zoom.
- **Highlights** are rendered inline inside the transformed content `<g>`. The transform applies automatically; no manual coordinate conversion is needed.

Building `worldToScreen` would have added a helper with no consumer. Skipping with documented reasoning > shipping unused code.

If browser verification turns up an actual positioning drift, the helper is straightforward to add: `worldToScreen(point, viewport, svgRect) = { x: svgRect.left + point.x * scale + panX, y: svgRect.top + point.y * scale + panY }`. But absent a real bug, no need.

### Active-row chrome via Framer `layoutId`

`layoutId` is Framer's shared-element animation primitive: when an element with a given `layoutId` unmounts and a *different* element with the same `layoutId` mounts elsewhere, Framer animates the layout transition between them. Perfect fit for "the active chrome should slide from old row to new row." Implementation is one `motion.div` swap; the duration (250ms) intentionally matches the iter-10 hover/press vocabulary.

The `displayedActiveTab` lag from iter-12 is preserved — it still governs how long the active chrome stays visible during the OPEN-to-EXPANDED close animation. The two are independent: lag governs *exit* visibility, layoutId governs *cross-row* movement.

---

## What stayed the same

- Every engine semantic.
- Every keyboard shortcut.
- All Framer Motion staged-close animations from iter-12.
- All breathing/pulse CSS keyframes.
- The popover and notification-highlight code (no change).
- The tool-menu CSS — `.tool-menu-row.active` styling unchanged; only the wrapper element type swapped from `<div>` to `<motion.div>`.

---

## Out of scope / deferred

- **Reduced-motion media query** — still deferred (iter-10 → iter-12 → iter-13 → next opportunistic UI iteration).
- **Animated popover follow-during-zoom** — recommendation in plan was "snap" (popover stays put while zoom animates). No work needed unless validation says otherwise.
- **`useAutomatonSimulationGlue` deeper test coverage** — QA-flagged; iter-15+.
- **`InputPanel` / `AlphabetEditor` RTL** — iter-15+.
- **`MiniTransitionSVG` geometry tests** — iter-15+ if it surfaces.

---

## Browser verification recommended

Wes should verify on next browser session:
1. **Pan + zoom boundaries** — try to "lose" the FA by panning at high zoom; should hit walls. At low zoom (small content), pan should be locked.
2. **Active-row swap** — click different tabs while OPEN; the active chrome should slide instead of snap.
3. **Popovers + highlights at zoom** — confirm they track state nodes correctly at scale 0.5 and scale 2. If they drift, iter-15+ adds the worldToScreen helper.

---

## How to run

```bash
cd /Users/wesorr/Documents/Projects/Project\ Automata/.claude/worktrees/iter-12
npm test -- --run            # 369 passing
npx tsc --noEmit             # clean
npm run dev                  # browser verification
```
