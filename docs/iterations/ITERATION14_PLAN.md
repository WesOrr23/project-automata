# Iteration 14 — UI Polish + Viewport Clamping (Plan)

## Context

Three UI rough-edges accumulated through iter-12, plus one new constraint Wes raised at the iter-13/14 planning point: the canvas viewport behaves oddly at the boundaries — at high zoom you can pan content most of the way out of view, and at low zoom you can pan further than feels right. The fix needs to be one cohesive clamping policy, not four ad-hoc patches.

The other three items are:
1. **Active-row element-swap smoothness.** When the user clicks a different tab in the tool menu, the new active card pops into "active" chrome before the layout settles. Reads as a flash.
2. **State-actions popover positioning at zoomed scale.** The popover anchors to the screen pixels of the underlying state node, but the node's rendered position is `(world × scale + pan)`. At any non-1× scale the popover drifts off the node.
3. **Notification highlight at zoomed scale.** Same issue. The highlight overlay is computed in world coordinates pre-transform.

This is the last "polish before features" iteration. After this, iter-15 starts the file save/load product feature.

## Goals

1. **Viewport clamping is one cohesive policy.** Content-aware bounds; no fragment of the automaton can leave the visible region. Behavior is identical at any zoom.
2. **Tool-menu active-row swap is one motion**, not a flash + settle.
3. **Popovers and highlights track the state node accurately at any zoom**, including during a zoom-in-progress (eased) animation.
4. **`tsc` clean. All tests green.** New tests for clamping math + screen-coord conversion helper.

## Non-goals

- New product features. (Save/load is iter-15.)
- Reduced-motion. (Still deferred.)
- Touch/multi-touch input beyond what trackpad pinch already handles.

## Phase order

### Phase 1 — Viewport clamping (the new requirement)

1. **Define the policy.** Three reasonable options:
   - **Strict bounding-box.** Content must always be fully inside the viewport. Painful at high zoom (you can't see one corner of the automaton without seeing all of it).
   - **Padded fit.** At least N pixels of content must remain visible (current ad-hoc behavior, but actually enforced).
   - **Centered slack.** When content is smaller than viewport, center it; lock pan. When larger, allow pan but clamp so content always overlaps the viewport by ≥ M%.
   - **Recommended:** "centered slack." Matches user mental model: the FA is the world; you scroll *within* it. When the world is smaller than the window, there's nothing to scroll to, so don't let pan drift.

2. **Implement the clamp.** Single helper in `useCanvasViewport`: `clampViewport(viewport, contentBoundingBox, viewportSize): CanvasViewport`. Called after every state update — wheel pan, drag pan, zoom (button or wheel), reset, fit, and the initial-center effect. Pure function; testable in isolation.

3. **Replace existing pan clamp** (currently keeps ≥80px visible) with the cohesive helper.

4. **Tests:** unit tests for `clampViewport` covering: small content + viewport (centered, pan = computed offset), large content (pan allowed within bounds), zoom changes content extent so prior pan becomes invalid (re-clamped), edge cases (zero-size content, zero-size viewport — both no-op).

### Phase 2 — Screen-coord conversion helper

5. The popover + highlight issue is the same root: world coords need to be converted to screen coords applying the current viewport transform. Today, callsites read `getBoundingClientRect()` of the state node — which works at scale=1 because there's no transform offset, but drifts at any other scale because the SVG's `<g style="transform: ...">` shifts the node relative to the SVG's bounding box.

6. **Add a helper:** `worldToScreen(point, viewport, svgRect): { x: number; y: number }`. Pure function. Lives in `src/hooks/useCanvasViewport.ts` (or a sibling util file). Exported.

7. **Migrate `StateActionsPopover` positioning** to use `worldToScreen` + the canonical state position from the layout (not `getBoundingClientRect()`).

8. **Migrate notification highlight overlay** to use the same helper.

9. **Tests:** unit tests for `worldToScreen` at scale=1, scale=2, scale=0.5, with non-zero pan, with non-zero `svgRect.left/top`.

### Phase 3 — Active-row element-swap smoothness

10. **Diagnose.** Most likely cause: the active class flips synchronously on state change, but Framer's layout animation for the row chrome (height + padding + border-radius) takes ~300ms. Resulting visual: chrome update happens at frame 1; layout settles at frame ~18.

11. **Fix candidates:**
   - **Crossfade two rows** during the swap (old fades out as new fades in).
   - **Stagger the chrome class** — apply on the new row only after layout-settle delay.
   - **Use Framer's `layoutId` shared element** so the active chrome morphs from old position to new in one motion.
   - **Recommended:** `layoutId`. It's literally what the API is for. Applies the chrome to a shared "active-row" id; Framer animates between mount points.

12. **Implement.** Add `layoutId="tool-menu-active-row"` to the active-row chrome element; Framer handles the rest. Verify on mount and on every tab change.

### Phase 4 — Animation-aware popover/highlight (during eased zoom)

13. **Question:** when a button-driven zoom animates from scale 1 → scale 2 over 300ms, does the popover/highlight need to follow the animation? Or is it fine for it to snap to the new position at the end?

14. **Recommended:** snap. The popover is interactive — animating it during a zoom would mean the user's click target moves under their cursor. Easier mental model: zoom is "view changes," popover is "tool stays put." Verify with Wes after Phase 3 and revise if it feels wrong.

15. If "follow the zoom" turns out to be the right answer, the implementation is straightforward (read viewport state on every animation frame instead of on state change), but adds complexity. Defer until validated.

## Success criteria

- At any zoom level, panning to the boundary feels like hitting a wall, not drifting into empty space.
- Popovers stay anchored to their state node at any zoom (within 1px of accurate).
- Tool-menu tab swap reads as one continuous motion with no chrome flash.
- `tsc --noEmit` clean. Test count: **350+ → 380+**.

## Risks

- **Clamping policy may conflict with the auto-center effect.** Mitigation: `clampViewport` runs *after* auto-center; if the centered viewport is in-bounds (which it always should be), the clamp is a no-op.
- **`worldToScreen` has to handle the case where state position isn't yet known** (layout hasn't returned). Mitigation: callers pass an explicit world point, not "the state with id X" — the caller is responsible for having the layout already.
- **`layoutId` for active-row chrome may interact badly with the staged close animation.** Mitigation: `layoutId` only applies to the active-row chrome (shared between mounts); the staged close animation is on the panel, not the row. Test both.

## Out of scope / future

- **Reduced-motion media query.** Still deferred.
- **Animated popover follow-during-zoom.** Pending Phase 4 validation.
- **Mobile / touch input.** Out of scope for this project entirely so far.
- **Smooth scroll-zoom on the trackpad** (kinetic). Not requested.
- **`InputPanel` / `AlphabetEditor` RTL backfill.** Iter-15+.
