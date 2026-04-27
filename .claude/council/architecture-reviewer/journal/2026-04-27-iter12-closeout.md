---
agent: architecture-reviewer
type: journal
iteration: 12
date: 2026-04-27
diff-hash: iteration-2..369cd14
schema-version: 1
---

# Iteration-12 close-out review

## Diff received

151 commits since `iteration-2` (~+32k/-921 lines across 244 files). Iter-12 absorbed iters 13–18: tool-menu staged-workflow rename (Configure→Define / Edit→Construct, label-only), CommandBar restructure (File dropdown, HISTORY segment, SIMULATE export, appMode='DEFINING'), image export (`src/lib/imageExport.ts`), two-stage zoom-fit button (`centerToContent`/`isCentered`), notification pause/resume + AnimatePresence, onboarding tour, debug overlay (⌘⇧D), Safari SVG-attribute transform fix, file save/load with recents, NFA→DFA + Hopcroft + complement + equivalence operations.

## My assessment

APPROVED WITH CONCERNS. Engine/UI separation, immutability, Result-type discipline, and granular-prop convention all hold. The Safari transform-attribute fix in `useCanvasViewport` is well-reasoned and well-commented. The new `useFileSession` / `useFileShortcuts` hooks decompose file ops cleanly.

Three concerns worth flagging:

1. **Keyboard-scope regression.** Four new components reintroduce raw `document.addEventListener('keydown', ...)` (useDebugOverlay, Onboarding, CommandBar popover, ComparePicker). Iter-11 went to four sites→zero; iter-12 opens four new ones. The Onboarding case is the worst — modal-flavored UI that should register a `capture: true` scope but doesn't.

2. **`src/lib/` introduced as a new top-level directory for a single file** (`imageExport.ts`). No CLAUDE.md entry. Image export is UI-domain (typed → SVG opaque → blob) and structurally fits `src/ui-state/`. Setting a precedent for a generic "lib" bucket invites future drift.

3. **App.tsx re-grew ~450 net lines** since iter-11's decomposition (file session glue, three operations handlers, export handlers, debug + onboarding hooks). Doesn't violate a documented invariant, but the operations handlers (convert/minimize/complement/compareAgainst) form a coherent cluster that mirrors the iter-11 `useAutomatonSimulationGlue` decomposition pattern.

## Smaller findings

- `imageExport` identifies debug overlay shapes by hard-coded hex color (`circle[fill="#ef4444"]`). Couples export to canvas styling. Should be a `data-debug-overlay` attribute.
- `buildExportSVGString` mutates the live SVG transform without try/finally. A `getBBox` throw leaves the canvas snapped to origin.
- `AutomatonCanvas.onContentBBoxChange` is a dead prop — App opted to live-measure inside imageExport instead. Either consume the prop (and remove the live mutation) or delete the prop.

## What I checked

- Engine/UI separation: scanned engine for React/DOM imports — none. New `imageExport.ts` lives in UI-land and imports zero engine.
- Granular-prop convention: `EditPanel` correctly takes `Automaton` (panel-level orchestrator); `AlphabetReadOnly` takes only primitives (`alphabet`, `highlightedSymbol`, `onJumpToAlphabet`). Convention honored.
- ToolMenu rename: confirmed runtime ids `'CONFIG' | 'EDIT' | 'SIMULATE'` unchanged in `toolMenu/types.ts`. Comment block explicitly justifies the label-only choice. Good.
- Snapshot description field: added cleanly via `Snapshot.description` in `useUndoableAutomaton`. Folded into the snapshot, so one undo restores it atomically. Consistent with the iter-11 epsilonSymbol pattern.
- Notification pause/resume: lives entirely in NotificationContext via per-id DismissEntry refs. No leakage of timer state into React. AnimatePresence wired in NotificationStack with `initial={false}` so existing toasts don't re-animate. Clean.
- imageExport boundary: `typed → opaque → blob` funnel is intact (one module, App is the sole consumer, no other module touches XMLSerializer or `<canvas>`). Minor concerns above.
- useCanvasViewport: `centerToContent` + `isCentered` are derived state, not stored — no possibility of the two diverging. Good.
- Safari transform fix: changed inner-g transform from CSS-style to SVG attribute, with a thorough comment citing WebKit #183237. Right call.

## What I deliberately did not check

- Type-correctness of new hooks (typescript-reviewer's domain).
- Test coverage of new branches (qa-reviewer's domain).
- localStorage key collision risk for `automata-debug-overlay`, `automata-onboarding-v1` (security-reviewer's domain).
- Notification AnimatePresence visual timing (writer's domain).

## Memory updates produced

- This journal entry.
- `keyboard-scope-stack.md` updated with the iter-12 regression note + bumped `verified-as-of` to `369cd14`.
- `engine-ui-separation.md` re-verified (frontmatter only) at `369cd14`.

## Outcome

The iteration ships a lot of UX value and the structural commitments hold, but the keyboard-scope regression is exactly the pattern-decay the iter-11 work was meant to permanently retire. Worth a follow-up cleanup pass before the regression hardens into precedent. The `src/lib/` directory is a small but real architectural drift — easy to relocate now, awkward later.
