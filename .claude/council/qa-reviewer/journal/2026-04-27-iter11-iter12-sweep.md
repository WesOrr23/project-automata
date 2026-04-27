---
agent: qa-reviewer
type: journal
iteration: 11+12 (combined catch-up)
date: 2026-04-27
diff-hash: 77de9ca..369cd14
schema-version: 1
---

# Iter-11 + iter-12 combined sweep — test-impact catch-up

## Context

Audit-002 P5/P6 flagged this agent as "stale on iter-11" — only the architect was spawned for the iter-11 close-out. This sweep covers iter-11 + iter-12 + the iter-13 through iter-17 work that has accumulated on `iteration-17-minify-and-menu` since the last QA pass at `a8f3381`.

## Diff received

77 commits, `77de9ca..369cd14`. Iter-11 (`Result<T>`, `exactOptionalPropertyTypes`, `useKeyboardScope`), iter-12 (preview consolidation, viewport hook), iter-13 (RTL backfill — StatePickerPopover, SimulationControls, control components), iter-14 (viewport clamp), iter-15 (file save/load + recents), iter-16 (NFA→DFA + Hopcroft minimization), iter-17 (OperationsWidget + complement + two-stage zoom + onboarding + image export + CommandBar redesign + notification pause/resume).

## Test suite at HEAD

**464 tests, 14 failures across 3 files, 7 TypeScript errors at compile.**

## My assessment

**Revision requested.** The iter-13 backfill closed many gaps the prior sweep flagged (StatePickerPopover, SimulationControls, useUndoRedoShortcuts), and iter-15/16/18 each shipped engine tests with the engine code (`format.test.ts`, `recentsStore.test.ts`, `fileAdapter.test.ts`, `converter.test.ts`, `equivalence.test.ts`, `minimizer.test.ts`, `operations.test.ts`, `ComparePicker.test.tsx`). That's the good shape.

But three categories of work shipped without test impact being addressed:

1. **CommandBar redesign (iter-15/17)** broke 9 tests; the surface they tested no longer exists.
2. **Two-stage zoom (iter-17)** added required props to CanvasZoomControls; 3 tests fail at runtime + 7 TS errors at compile. Same iter added DISPLAY_FIT_PADDING which broke 2 useCanvasViewport tests.
3. **iter-17 net-new surfaces** (useDebugOverlay, useOnboarding, Onboarding, useFileSession, useFileShortcuts, imageExport, NotificationContext.pause/resume) shipped with zero coverage.

## Findings

### Tier 1 — Test breakage (load-bearing, blocks CI)

**F1. CommandBar tests broken — 9 failures, behavior gone, NOT recoverable by fixture updates.** `src/components/__tests__/CommandBar.test.tsx`

The tests were written against the iter-15-era layout (separate `aria-label="New"`, `"Open"`, `"Save"` buttons + `aria-label="More file actions"` ⋯ overflow + `aria-label="Operations"` button + standalone `aria-label="Recents"` button). The current `CommandBar` (`be89644`, `4a47fec`, `1552ac1`, `39c9535`) has:

- A **single** `aria-label="File menu"` button that opens a popover containing New/Open/Save/Save As/Recents (`CommandBar.tsx:338`).
- The Operations button is now `aria-label="Tools"` (`CommandBar.tsx:497`).
- The standalone Recents button has been removed — Recents lives inside the File popover (`CommandBar.tsx:411-444`).
- The ⋯ popover ("More file actions") is gone — Save As is now inside the File popover (`CommandBar.tsx:392-406`).

The 9 failing tests aren't checking incidental shape; they're checking surfaces that no longer exist. Discrete File buttons and the ⋯ overflow were deliberately removed (commit `4a47fec` "collapse file ops into a single File dropdown" and `39c9535` "drop tour from File menu"). The Recents-as-its-own-button was dropped in the same redesign.

**Recoverability**: the *intent* of each test (file callbacks fire, recents render, Save As reachable, Operations menu shows in EDITING) is still verifiable, but the test bodies need a rewrite that opens the File popover first, then asserts on the popover items — not a fixture tweak. The 6 still-passing tests (rename, undo/redo flag handling) survived because those surfaces survived. Severity: **high** — CI won't go green until rewritten or removed.

**F2. CanvasZoomControls tests broken — 3 failures + 7 TS errors at compile time, fixture-recoverable but test intent partially obsolete.** `src/components/__tests__/CanvasZoomControls.test.tsx`

`defaultProps()` predates the iter-17 two-stage zoom button (`612e6fe`, `a611034`). The component now requires `centerToContent: () => void` and `isCentered: boolean` and accepts `fitScale?: number | null`. `tsc --noEmit` reports 7× TS2739 errors on this file, one per test that calls `render(<CanvasZoomControls {...defaultProps()} />)`. At runtime, the missing `isCentered` defaults the middle button into the "Recenter" branch, so `getByLabelText(/Fit to view/)` fails to find the button.

Two tests are partially obsolete: "renders three labeled buttons (no 1:1)" still asserts the right thing (no 1:1 button), but the middle-button label now varies on `isCentered`. "Fit click invokes fitToContent" needs to set `isCentered: true` to get the Fit branch.

**Recoverability**: yes — add `centerToContent: vi.fn()` and `isCentered: true` to `defaultProps()`, then add at least one test for the `isCentered: false` branch (Recenter dispatch) which is currently uncovered. Severity: **high** for compile, **medium** for the missing branch test.

**F3. useCanvasViewport tests broken — 2 failures, comment math doesn't match implementation.** `src/hooks/__tests__/useCanvasViewport.test.ts:43-55, 250-256`

Both failing tests assert `scale = 1.15` from `min(920/800, 720/600)` with a **40-pixel** padding. The current implementation in `useCanvasViewport.ts:39-47` uses **two** padding constants — `FIT_PADDING = 40` (the action) and `DISPLAY_FIT_PADDING = 180` (the display reference + the auto-fit-on-mount path). The auto-fit and `fitToContent` both go through the DISPLAY_FIT_PADDING branch (`useCanvasViewport.ts:343-344, 693-694`), giving `min(640/800, 440/600) = 0.7333` — exactly what the failure trace shows.

This isn't a regression in the implementation. The DISPLAY_FIT_PADDING split was added deliberately so "100% display = relaxed view" rather than "100% = tight fit." The test is asserting against the prior behavior. Severity: **medium** — the test, not the code, is wrong.

**Recoverability**: yes — update the test math to use `DISPLAY_FIT_PADDING = 180` (or, better, **add a test for both branches** since FIT_PADDING is still load-bearing for the Fit-to-view *action* in the visible-region path).

### Tier 1 — Untested new surfaces (test gap, not a break)

**F4. `useDebugOverlay` has zero tests.** `src/hooks/useDebugOverlay.ts`

90-line hook with non-trivial logic: localStorage read/write with quota-fail tolerance, `useRef` to avoid re-binding the global keydown listener, deliberate StrictMode-double-invoke avoidance via setState-with-resolved-value (this avoidance is *the entire reason* commit `d6ded4a` exists — "no duplicate toast in StrictMode dev"). The notify side effect runs from outside the setState updater specifically to make the dev-StrictMode double-invoke harmless. None of this is verified by a test. Severity: **medium** — quiet on the surface, but the StrictMode trap is exactly the kind of regression that returns silently if the implementation is restructured.

**F5. `useOnboarding` has zero tests.** `src/hooks/useOnboarding.ts`

60-line hook. Lazy initializer reads localStorage exactly once on mount; `dismiss()` writes; `show()` is the re-open path. Versioned key (`automata-onboarding-v1`). The version-bump-resets-everyone behavior is a documented contract. No test coverage. Severity: **low-medium** — small surface, but easy to test (inject a stub `window.localStorage`).

**F6. `Onboarding` component has zero tests.** `src/components/Onboarding.tsx`

250-line component with non-trivial behavior: useLayoutEffect-driven target measurement via `getBoundingClientRect`, three-step state machine, Esc / outside-click / Got-it dismissal, dynamic placement of caption pill. The dismissal paths are the most testable — three different routes that all need to call `onDismiss`. No coverage. Severity: **medium** — primary user-onboarding surface; a regression here breaks the first-launch experience invisibly.

**F7. `imageExport` library has zero tests.** `src/lib/imageExport.ts`

237 lines of high-risk DOM manipulation: SVG cloning, transform reset on the live SVG (with restore in a try/finally), bbox measurement, style inlining via `getComputedStyle`, viewBox retargeting, optional white-background rect, debug-overlay stripping. Two export paths (PNG via canvas, SVG direct download). The transparent-background option (`369cd14`) gates the white rect. Several reasons this is high-risk: the live-SVG transform manipulation can leave the canvas in a bad state if an exception fires between save and restore; the bbox measurement happens synchronously on the live DOM which is fragile to "happens before paint" assumptions; jsdom-based testing of getBBox is famously imperfect.

A jsdom test can at least verify: `buildExportSVGString` returns a valid SVG string with the expected viewBox shape; transparent option toggles the bg rect; the live SVG transform is restored after the call (test-the-promise rather than the pixel output). Severity: **medium-high** — the centerpiece of the "share your work" feature.

**F8. `pauseDismiss` / `resumeDismiss` on `NotificationContext` have zero tests.** `src/notifications/NotificationContext.tsx:115-129`

The general-purpose audit before mine flagged this as high-priority and was right. The hover-pause feature (`dff886e`) added two new public surface methods to a previously well-tested context (`NotificationContext.test.tsx` is 174 lines, all on notify/dismiss/rehighlight). Pause-resume has subtle math: `remainingMs = Math.max(0, remainingMs - (Date.now() - startedAt))` and a re-armed `setTimeout` with the residual. Easy to break (sign error, double-pause, pause-then-dismiss-then-resume race). None of these branches are guarded. Severity: **high** — contract-level addition to a tested API, no coverage, easy to regress, easy to test (fake timers + the pattern already used in this file).

**F9. `useFileSession` has zero tests.** `src/hooks/useFileSession.ts`

245-line hook orchestrating save/saveAs/open/new with notifications, recents updates, beforeunload guards, error normalization (`file-cancelled` swallowed, others routed to error notifications). The adapter is injected, which means it's mock-friendly. The whole thing is testable with a stub adapter and a mock `notify`. Severity: **medium-high** — high-leverage code (every save/load goes through here) with no safety net.

**F10. `useFileShortcuts` has zero tests.** `src/hooks/useFileShortcuts.ts`

71 lines. Maps ⌘/Ctrl+S, ⌘/Ctrl+Shift+S, ⌘/Ctrl+O, ⌘/Ctrl+N to four callbacks via `useKeyboardScope`. The four conditional branches each preventDefault and dispatch one callback. Same pattern as `useUndoRedoShortcuts.test.ts` (which has 5 tests for analogous logic). Should follow the same template. Severity: **low-medium** — small but the only thing standing between the user and the browser eating ⌘S as "save page as HTML."

### Tier 2 — Coverage holes worth knowing

**F11. `centerToContent`, `isCentered`, and `fitScale` on `useCanvasViewport` are exported but never directly tested.** `src/hooks/useCanvasViewport.ts:524, 706-714, 687-697`

These are the iter-17 two-stage zoom logic. The `useCanvasViewport.test.ts` only mentions `fitScale` in a math comment. The middle-button-decides-which-action behavior in `CanvasZoomControls` depends on `isCentered`, which is computed per-render based on bbox/viewport ratios. No test verifies the threshold (when does isCentered flip true vs false?), no test verifies `centerToContent` actually centers, and no test verifies `fitScale` matches the displayed percentage. Combined with F2, the entire two-stage middle button is unverified.

**F12. AutomatonCanvas's `onSvgRefChange` lift pattern is untested.** `src/components/AutomatonCanvas.tsx:227-232`

The new `onSvgRefChange` callback prop (used by App for image export) fires on mount/unmount. The `AutomatonCanvas.test.tsx` doesn't pass `onSvgRefChange`, so the unmount path that nulls the parent's ref is unexercised. Image export depends on this ref being current. Low-priority because the contract is small (call with element on mount, call with null on unmount), but worth one test.

**F13. `useFileSession`'s beforeunload guard is the kind of thing that silently breaks.** `src/hooks/useFileSession.ts:107-115`

Adds/removes a `beforeunload` listener gated on `isDirty`. Easy to test (mount with `isDirty: true`, dispatch a beforeunload event, assert `defaultPrevented`). Worth one test inside whatever F9 produces.

### Tier 2 — Test quality checks (still-meaningful audit)

The existing tests I sampled remain meaningful — they assert on observable behavior, not internal shape:

- `engine/__tests__/operations.test.ts` (109 lines) — `complement of complement is the original`, `accepts exactly the inputs the original rejects`. Property-style assertions, not shape pinning. ✓
- `files/__tests__/format.test.ts` (220 lines) — round-trip serialize→parse, rejection paths for malformed inputs. Each assertion names a real contract. ✓
- `files/__tests__/recentsStore.test.ts` (119 lines) — eviction, in-place update, size cap, ID retrieval. Real behavior. ✓
- `components/__tests__/SimulationControls.test.tsx` (147 lines) — every test names a user-observable behavior (Play→Pause icon swap, disabled-when-finished, banner on accept/reject, click-to-jump). ✓
- `hooks/useKeyboardScope.test.ts` — stack ordering, capture vs transparent, text-input filter, latest-closure usage. The text-input + capturing-scope interaction (line 161) is exactly the sort of test audit-002 F10 was asking for. ✓

I found no tests that fit the "pinning incidental shape" anti-pattern. The earlier worry was unfounded.

## What I checked

- Ran `npx vitest run` — 14 failures (3 useCanvasViewport, 9 CommandBar, 2 CanvasZoomControls effective; total = 14 between failure trace and TS-blocked render assertions).
- Ran `npx tsc --noEmit` — TS2739 ×7 in `CanvasZoomControls.test.tsx`.
- Read CommandBar.tsx (633 lines) end-to-end; the layout the tests assume was deliberately removed in `4a47fec` and `39c9535`.
- Read CanvasZoomControls.tsx (126 lines); confirmed required-prop additions (`centerToContent`, `isCentered`) are load-bearing.
- Read useCanvasViewport.ts §339-345, §417-418, §687-697; confirmed FIT_PADDING vs DISPLAY_FIT_PADDING split is intentional.
- Read useDebugOverlay.ts; confirmed StrictMode-avoidance is the entire reason for the `useRef` indirection.
- Read useOnboarding.ts (60 lines), Onboarding.tsx (250 lines), NotificationContext.pauseDismiss/resumeDismiss (15 lines, lines 115-129), useFileSession.ts (245 lines), useFileShortcuts.ts (71 lines).
- Sampled engine/operations.test.ts, files/format.test.ts, files/recentsStore.test.ts, components/SimulationControls.test.tsx — all meaningful.

## What I did not check

- Image export's PNG path end-to-end (canvas APIs in jsdom are notoriously flaky).
- ToolMenu / EditPanel / DefinePanel components — pre-existing gaps, not iter-12+ regressions.
- Architecture / type correctness of the new code (architect's + TS-reviewer's domain).
- Visual / motion correctness of the CommandBar redesign and onboarding overlay.

## Test quality

The existing test suite is still meaningful — no shape-pinning, no over-mocking, no "function exists" tests. The injected-adapter pattern in `fileAdapter.test.ts` is a particularly clean template for the missing `useFileSession` tests. The fake-timers pattern in `NotificationContext.test.tsx` extends naturally to pause/resume.

## Memory updates produced

- This journal entry.
- `known-coverage-gaps.md` — remove iter-11/13/15-closed gaps (StatePickerPopover, SimulationControls, AutomatonCanvas core test introduction, computePreview branches, graphviz parse helpers); add iter-12+ open gaps section; add tests-exist-but-broken section for F1/F2/F3; bump `verified-as-of` to `369cd14`.
- `test-coverage-map.md` — rewrite components row, add `lib/` row, bump `verified-as-of` to `369cd14`.
- `test-patterns.md` — add fake-timers + injected-adapter as canonical templates for the queued backfills, bump `verified-as-of` to `369cd14`.

## Outcome

Revision requested: F1, F2, F3 should be addressed before the branch merges (broken tests + TS errors block CI). F8 (notification pause/resume) is also high-priority because the contract is documented and trivial to test. F4-F10 form the iter-18 backfill ticket.
