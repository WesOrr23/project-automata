---
agent: qa-reviewer
type: knowledge
topic: known-coverage-gaps
schema-version: 1
verified-as-of: 369cd14
last-updated: 2026-04-27
confidence: high
---

# Known Coverage Gaps

## Principle

Specific, named gaps in test coverage that have been catalogued. The auditor uses this list to detect when claimed-tested code is in fact in this list. Reviewers cite this when a diff touches a known-gap area without addressing the gap.

## Current state

### Tests-exist-but-broken (load-bearing, blocks CI as of 369cd14)

These were green at the time their assertions were written; intervening UI restructures (CommandBar redesign, two-stage zoom, DISPLAY_FIT_PADDING split) deleted or reshaped the surfaces the tests assumed. Recovery is **not** a fixture tweak in two of three cases — it's a rewrite against the new surface.

- **`src/components/__tests__/CommandBar.test.tsx`** (9 failures, **NOT fixture-recoverable**). Tests target the iter-15-era separate `aria-label="New" / "Open" / "Save"` buttons, the `aria-label="More file actions"` ⋯ overflow, the standalone `aria-label="Recents"` button, and `aria-label="Operations"`. All four were deliberately removed (`4a47fec` collapsed file ops into a single File popover; `39c9535` dropped Show tour; `be89644` renamed Operations→Tools). The intent of each test (file callbacks fire, recents render, Save As reachable) is still verifiable against the new layout, but each test body needs to open the File popover first then assert on popover items. The 6 still-passing tests (rename, undo/redo flag handling) survived because those surfaces survived.
- **`src/components/__tests__/CanvasZoomControls.test.tsx`** (3 runtime failures + 7 TS2739 errors, **fixture-recoverable**). Iter-17 (`a611034`) added required props `centerToContent: () => void` and `isCentered: boolean`. Add both to `defaultProps()`, set `isCentered: true` for the Fit-branch tests, add at least one Recenter-branch test for the now-uncovered `isCentered: false` path.
- **`src/hooks/__tests__/useCanvasViewport.test.ts:43-55, 250-256`** (2 failures, **test-math-wrong-not-code-wrong**). Tests assert `scale = 1.15` from `min(920/800, 720/600)` with a 40-pixel padding. Implementation now uses a `FIT_PADDING = 40` (action only) vs `DISPLAY_FIT_PADDING = 180` (display reference + auto-fit-on-mount + `fitToContent` action) split. Auto-fit goes through DISPLAY_FIT_PADDING giving `min(640/800, 440/600) = 0.7333`. Update the test math; ideally add coverage for both branches since FIT_PADDING is still load-bearing in the visible-region path.

### iter-12+ untested surfaces (test gap, not a break)

Net-new code shipped without coverage. Listed in priority order for the iter-18 backfill ticket.

- **`src/notifications/NotificationContext.pauseDismiss/resumeDismiss`** — public-API addition (commit `dff886e`). Subtle math: `remainingMs = Math.max(0, remainingMs - (Date.now() - startedAt))`. Easy to break (sign error, double-pause, pause-then-dismiss-then-resume race). The `NotificationContext.test.tsx` fake-timers pattern extends naturally. **High** priority.
- **`src/lib/imageExport.ts`** — high-risk DOM manipulation: SVG cloning, live-SVG transform reset/restore, getBBox measurement, getComputedStyle inlining, viewBox retargeting, debug-overlay stripping, optional white-bg rect, PNG-via-canvas + SVG-direct paths. jsdom can verify `buildExportSVGString` shape, `transparent` flag toggling the bg rect, and live-SVG transform restoration after the call. The PNG path's canvas APIs in jsdom are flaky; test the promise resolution rather than the pixels. **Medium-high**.
- **`src/hooks/useFileSession.ts`** — orchestrates save/saveAs/open/new with notifications, recents updates, beforeunload, error normalization (`file-cancelled` swallowed, others routed to error notifications). The injected adapter is mock-friendly (template: `fileAdapter.test.ts`). **Medium-high**.
- **`src/hooks/useDebugOverlay.ts`** — StrictMode-double-invoke avoidance via setState-with-resolved-value is the entire reason commit `d6ded4a` exists. Notify side effect runs from outside the updater specifically to make the dev double-invoke harmless. The trap returns silently if restructured. **Medium**.
- **`src/components/Onboarding.tsx`** — three dismissal paths (Esc, outside-click, Got-it button) all routing to `onDismiss`. useLayoutEffect-driven target measurement via `getBoundingClientRect`. Three-step state machine. **Medium** (primary first-launch surface; regressions are silent).
- **`src/hooks/useFileShortcuts.ts`** — ⌘/Ctrl+S/Shift+S/O/N → callback dispatch via `useKeyboardScope`. Same template as `useUndoRedoShortcuts.test.ts`. **Low-medium**.
- **`src/hooks/useOnboarding.ts`** — versioned-key contract (`automata-onboarding-v1`). Lazy initializer reads localStorage once, `dismiss()` writes, `show()` re-opens. Inject a stub `window.localStorage`. **Low-medium**.

### iter-12+ Tier-2 holes worth knowing

- `centerToContent`, `isCentered`, `fitScale` on `useCanvasViewport` — exported but never directly tested. `isCentered` flip threshold, `centerToContent` actually centering, `fitScale` matching displayed percentage are all unverified. Combined with the broken CanvasZoomControls test, the entire two-stage middle zoom button is unverified.
- `AutomatonCanvas.onSvgRefChange` lift pattern (`src/components/AutomatonCanvas.tsx:227-232`) — fires on mount/unmount; image export depends on the ref being current. Test isn't passing the prop, so the unmount-null path is unexercised.
- `useFileSession` beforeunload guard (`src/hooks/useFileSession.ts:107-115`) — gated on `isDirty`. Easy to test inside whatever F9 produces.

### `ui-state/utils.ts` math helpers

Closed in iter-11 — `graphvizParse.test.ts` exists. (Was: `parseEdgePos`, `controlPointsToSvgPath`, `flipY`, `automatonToDot`, `parseGraphvizJson`, `transformPoint`, `buildTransformedPath`, `computeArrowheadAngle`, `parseEdgeLabel`. Iter-3 architectural-precondition for export is no longer blocking.)

### `computePreview` conflict-detection branches

Closed in iter-13 (RTL backfill) — `creationReducer.test.ts` exercises both DFA conflict branches and the iter-8 `isNFA` short-circuit.

### Components — across the board (largely closed)

The iter-13 RTL backfill plus iter-15/16/18 component additions closed most of the iter-3 sweep. Remaining gaps:

- `AutomatonCanvas` — has a test file but minimal coverage of the new lift-ref pattern, the debug-overlay shapes, and the inset-shift effect. Was on the original gap list since iter-2; partially closed.
- `MiniTransitionSVG` — still no tests since iter-7 introduction.
- `ToolMenu` and its panel children (`AlphabetEditor`, `AlphabetReadOnly`, `ConfigPanel`, `EditPanel`, `StateEditor`) — no tests. Iter-12 reshaped these substantially (alphabet move, description field, AlphabetReadOnly creation, jump-to-Define wiring).
- `InputPanel` and its iter-17 batch-test trigger button — no tests. The new `BatchTestModal` (iter-17) — no tests.
- `TransitionCreator` — no tests since iter-7 introduction; substantial logic.

### App-level integration

Still no integration tests for App-level flows like "click an edge, change a symbol, click Modify, see the canvas update." Worth one or two RTL-renders-App-with-mocks tests at some future point.

## What to look for in diffs

- Diffs adding test coverage for items in this file: those items can be removed from the gap list when the new tests are merged. Update this file in the same iteration.
- Diffs that touch a gap area without adding tests: flag explicitly. The gap is documented; ignoring it is a deliberate choice that should be acknowledged.
- Diffs that introduce a new gap (new untested code in an under-tested area): flag and add to this list.
- Diffs that reshape a UI surface that has tests: confirm the tests still target the surface (not a deleted shape). The CommandBar/CanvasZoomControls/useCanvasViewport breakages would have been caught earlier with this discipline.

## What's fine

- This list growing slowly as the codebase grows. New code creates new gaps; that's expected.
- Coordinated fix-up iterations that close several gaps at once (e.g., the iter-13 RTL adoption iteration that closed ~half the iter-3 sweep).

## Provenance

Iteration-1 code review (2026-04-25). Updated 2026-04-27 after the combined iter-11+iter-12 catch-up sweep at HEAD `369cd14`. The iter-13 RTL backfill, iter-15/16/18 engine additions, and iter-11 graphvizParse export each closed previous gaps; the iter-15/17 UI redesigns + iter-17 net-new surfaces each opened new ones.
