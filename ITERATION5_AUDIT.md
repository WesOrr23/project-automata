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

### User testing findings (iter 5 post-ship)

From manual testing pass:

**Real bugs to fix:**
- Sidebar grow/shrink visual glitch on mouseleave from EXPANDED → COLLAPSED. Icons momentarily render at full container width (140px) before width transition shrinks. Root cause: `aspect-ratio: 1/1` on icons combined with `width: 100%` and animated container width.
- `.tool-menu-open` max-height causes content cutoff when transitions exceed viewport. `overflow-y: auto` on the outer aside isn't reaching the card content. Fix scroll chain.
- Keyboard navigation: only the "new symbol" text input is reachable via Tab. Buttons should be in tab order. Investigate.

**UX improvements to make:**
- Trash / action icons should only appear on row hover (reduce visual clutter).
- Duplicate transition error currently renders at the bottom of Edit panel — invisible when list overflows (see scroll bug). Move to a better position (toast, near the Add button, floating badge).
- When a duplicate transition is attempted, also highlight the existing conflicting transition (in the list AND on canvas).
- Validation messages ("state is unreachable") need more context to be actionable. Structured validation data would let UI render clickable fixes.
- Show validation errors in Edit tab too, not just Simulate. Ideally inline with the transition section showing which transitions are missing.
- Smooth animations between tab switches in OPEN state (currently DOM swap).
- Detect copy-paste into the symbol input. Warn if truncated.
- Self-loop (and bi-directional) transitions with the same from/to but different symbols should be merged visually into a single edge with comma-separated labels (e.g. `a,b`).

**Structural redesigns (may need own iteration):**
- In OPEN state, cards should be visually separate widgets — each its own card with its own shadow. Currently they share one menu container. Back button should live inside the active card's header (top-right), not floating above all three.
- Move alphabet editor from Config tab to Edit tab. Config should be for app-level settings (preferences, toggles like "warn before delete"), not automaton structure.

**Soft-reset of simulation:**
Currently switching to Edit tab hard-resets simulation. Instead: keep input string and history, just drop the visual highlights. Only actually reset when an edit occurs. Protects against accidental tab click destroying user progress.

**Future features:**
- Custom state labels (rename states from "q0" → user-chosen).
- Preferences: "warn before delete if there are dependent transitions", auto-layout on/off, etc.

**Ghost transitions (own iteration — DFA only):**
A "ghost mode" toggle that visualizes missing required transitions on the canvas. Two implementation tiers:

- *Tier 1 (small, doable now):* Badge on each state showing missing-symbol count, e.g. `q0 ⚠1`. Click/hover reveals the specific symbols. Uses `getMissingTransitions()` which already exists.
- *Tier 2 (own feature):* Faded grey edges from each state for each missing symbol, routed to a placeholder target (single "?" position outside the graph, or self-loop with a `?` label). Off by default. Pre-cooked into the GraphViz feed.

NFAs don't need this — completeness isn't required.

**Auto-increment transition form:**
After successfully adding a transition (`q0 → q0 on '0'`), advance the form's symbol/from/to to the next undefined transition: `q0 → q0 on '1'`, then `q0 → q1 on '0'`, etc. Cycles through all (state, symbol) pairs. Optional preference toggle in Config.

**Custom dropdowns:**
Native `<select>` feels dated against the rest of the design. Replace with a styled custom dropdown (or use a headless library). Keep keyboard accessibility.

**Empty-string simulation:**
No way to test the empty string currently — the input must have at least one character. Allow Play with empty input; the simulation just checks if start state is an accept state.

**Notification system (own iteration):**
A global, always-accessible notification/toast system replacing scattered inline error banners:
- Stacks in top-right corner of viewport.
- Each notification has a short title (immediately visible) + click-to-expand description.
- Severity: error / warning / info, colored accordingly.
- When thrown, briefly highlights the source of the error (on canvas AND in tool menu — e.g., pulse the conflicting transition edge and the conflicting transition-list row).
- Auto-fade the highlight after a short duration; click the notification to re-highlight.
- Consumed via a `useNotifications()` hook backed by a React Context store — any component can `notify({severity, title, detail, target})` without prop drilling.
- Subsumes current `editError`, `ValidationView`, and inline form errors.

Architectural fit: replaces the current mixture of inline error handling with a single, composable notification layer. Matches the "make illegal states unrepresentable" philosophy by keeping error surfacing out of layout code.

**Design discussion items:**
- `nextStateId` behavior — engine doesn't reuse IDs of deleted states. After creating q0,q1,q2,q3 then deleting q3,q2,q1, the next Add gives q4 (not q1). Rationale: stable identifiers — IDs are promises, once assigned they don't point to a different state later. Alternative would be reusing deleted IDs, but that breaks the invariant. Worth discussing whether the user-visible `q#` labels should be detached from internal IDs (display "q1" for the second state by position, regardless of internal ID).

### TODO — Extract `EditorRowButton` component
Discussed during review walkthrough of StateEditor.tsx. The three action buttons (Start toggle, Accept toggle, Delete) share structural shape:

```typescript
type EditorRowButtonProp = {
  icon: LucideIcon;
  onClick: () => void;
  ariaLabel: string;
  title?: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
};
```

Both `StateEditor.tsx` and `TransitionEditor.tsx` would consume this. Reduces ~40 lines of duplication and gives one place to fix any future button-behavior change.

**Explicitly NOT a discriminated union** — the buttons vary only by parameter values, not by distinct data shapes. Plain object type is correct.

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
