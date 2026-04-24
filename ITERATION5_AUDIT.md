# Iteration 5 Audit

Findings from the post-implementation codebase review. Organized by severity and category. Items marked ✓ FIXED were addressed during the audit pass; unmarked items are deferred for future iteration polish.

---

## Priority fixes (addressed before commit)

### ✓ FIXED — Collapsed icon buttons were dead on click
**File:** `src/components/toolMenu/ToolMenu.tsx`
Icon buttons in COLLAPSED mode had no `onClick`. Users had to hover, wait for expansion, then click the pill — two gestures for what should be one. Now clicking an icon opens its tab directly, matching natural user expectation.

### ✓ FIXED — Layout race condition on rapid edits
**File:** `src/App.tsx`
The debounced `computeLayout` call didn't guard against out-of-order promise resolution. If layout call N-1 took longer than N (e.g., due to scheduler variance), the stale result could clobber the fresh one — visually a "jumping" graph. Added a `layoutVersionRef` counter: only the promise whose version matches the current ref commits its result.

### ✓ FIXED — Error banner was keyboard-inaccessible
**File:** `src/components/toolMenu/EditPanel.tsx`
The dismissible error banner had `role="button"` and `tabIndex={0}` (correctly announcing as a button), but no `onKeyDown` handler. Keyboard users saw a focusable button they couldn't activate. Added Enter/Space handling.

---

## Correctness

### Engine-level cascade semantics are sound
- `removeState` correctly removes the state *and* all transitions touching it, and reassigns start state if needed.
- `handleAlphabetRemove` in App.tsx cascades by filtering transitions using the removed symbol. The engine itself doesn't enforce this because the alphabet is data, not a constraint on existing transitions.
- `handleAlphabetRemove` prevents removing the last symbol (engine requires non-empty alphabet).

### TransitionEditor default state is defensible
`sortedStates[0] ?? 0` as the initial `fromState` fallback is technically unreachable (engine invariants guarantee states ≠ ∅), but would fail silently if that invariant were ever broken. Acceptable; worth a comment.

### No NFA-era bugs in remove flow
`removeTransition` uses Set-equality matching, which works correctly for DFAs (single-element `to` sets). When NFA support lands, the UI will need to allow targeting specific multi-destination transitions — but that's an NFA concern, not a current bug.

---

## Type safety

### One non-null assertion
**File:** `TransitionEditor.tsx:127` — `destinations[0]!`
The `!` forces non-null on the first element of a destinations array derived from `transition.to`. Since every transition has at least one destination, this is safe in practice. Could be replaced with a guard for zero-cost extra safety.

### `onRemoveTransition` accepts `string | null` for symbol
The signature accepts `null` to support ε-transitions (future NFA feature). Current UI never passes `null`. Forward-compatible; no issue.

### All prop types use singular `{Name}Prop` convention
Consistent with the existing codebase. ✓

---

## Accessibility

### Addressed
- ✓ Error banner keyboard activation (Enter/Space).
- ✓ Collapsed icons are clickable (not hover-only).

### Deferred
- Consider `<nav>` instead of `<aside>` on the tool menu root for proper landmark semantics.
- Disabled delete buttons in StateEditor have `title` tooltips but not enriched `aria-label` explaining the disable reason.

---

## Performance (all deferred — no measurable impact at current scale)

- `StateEditor` and `TransitionEditor` sort their source arrays on every render. `useMemo` would eliminate this, but cost is negligible for typical automata.
- App handlers are recreated on every render. `useCallback` would stabilize their identity, but since the child tree is shallow, no measurable re-render cost today.
- All three content panels (`configContent`, `editContent`, `simulateContent`) are constructed in App's render even when inactive. Lazy evaluation (pass callbacks, not JSX) would save work but complicate the API.

---

## Style / consistency

### Deferred — Case mismatch in string literals
- Existing codebase: `'idle' | 'running' | 'paused' | 'finished'` (lowercase).
- New in iter-5: `'CONFIG' | 'EDIT' | 'SIMULATE'`, `'COLLAPSED' | 'EXPANDED' | 'OPEN'` (uppercase).

Both are valid; mixed casing is mildly inconsistent. Not changing now because:
1. Existing code also has `'DFA' | 'NFA'` (uppercase), so there's precedent for uppercase when values feel like constants/enums.
2. Renaming touches many files for low real benefit.

Document the convention going forward: uppercase for tab/mode identifiers ("feels like a named constant"); lowercase for status values ("feels like a state description").

### Deferred — Inline flexbox styles
Several components have `style={{ display: 'flex', ... }}` inline. Candidate for `.flex-col` / `.flex-row` utility classes. Would reduce duplication across StateEditor, TransitionEditor, ConfigPanel.

### Deferred — Hardcoded warning colors
`index.css` has `#fffbeb`, `#b45309`, `#fde68a` inline for `.editor-validation-banner.warning`. Should be `--warning-bg` / `--warning-text` / `--warning-border` tokens alongside the existing `--success-*` and `--error-*` variables.

---

## Architecture

### App.tsx is getting long (~370 lines)
A `useToolMenu()` custom hook could encapsulate `menuState`, the four nav callbacks, and return a flat API — removing ~40 lines from App. Worth doing if App grows further; premature now.

### No tests for iter-5 UI
The 131 existing tests all pass, but none cover:
- `ToolMenu` state transitions
- `ConfigPanel` alphabet validation flow
- `StateEditor` CRUD
- `TransitionEditor` add/remove with error handling
- `EditPanel` error banner dismissal
- `App.tsx` integration (clicking Add State really calls `addState` and updates state)

Highest-value target: the 3-state ToolMenu FSM, because correctness there is load-bearing for all editing UX.

---

## Summary

| Category | Severity | Count | Status |
|---|---|---|---|
| Correctness bugs | High | 2 | ✓ Both fixed |
| Accessibility gaps | Medium | 1 keyboard + minor | ✓ Keyboard fixed, minor items deferred |
| Type safety | Low | 1 non-null assertion | Acceptable; no action |
| Style inconsistency | Medium | 1 case mismatch | Deferred with documented rationale |
| Performance | Low | 3 optimizations | Deferred (no measurable impact) |
| Architecture | Medium | 1 refactor, 0 tests | Deferred |

Iteration 5 ships with all HIGH-severity items resolved and all deferred items documented.
