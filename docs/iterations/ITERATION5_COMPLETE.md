# Iteration 5: Manual Editing — Complete

**Goal**: Make the automaton editable through a 3-state sidebar (Configure / Edit / Simulate). Users can configure the alphabet + type, add/remove states, set start/accept, add/remove transitions, and export to JSON — all via a tool menu, with the canvas as a pure read-only view.

**Status**: **COMPLETE** — All 131 tests passing, audit completed with HIGH-severity items resolved.

---

## What We Built

### 1. Tool Menu — Three-State Sidebar

A sidebar with a discriminated-union state machine (`ToolMenuState`):
- **COLLAPSED** — narrow icon strip (3 icons: Settings, Pencil, Play)
- **EXPANDED** — icons + labels (on hover)
- **OPEN** — one of three submenus active (CONFIG / EDIT / SIMULATE), the other two visible as compact cards

Transition table:

| From → To | Trigger |
|---|---|
| COLLAPSED → EXPANDED | `onMouseEnter` on the strip |
| EXPANDED → COLLAPSED | `onMouseLeave` from the strip |
| COLLAPSED → OPEN | click on icon button (audit fix) |
| EXPANDED → OPEN | click on pill |
| OPEN → OPEN (swap tab) | click another compact card |
| OPEN → COLLAPSED | click the `‹` back button |

### 2. Configure Tab (`ConfigPanel.tsx`)
- DFA / NFA type toggle
- Alphabet badges + add form (single character; duplicate validation)
- Export JSON button (Set → Array conversion + `Blob` + synthetic-anchor download)

### 3. Edit Tab (`EditPanel.tsx`)
- **StateEditor** — Add button + per-state row with start / accept / delete actions
- **TransitionEditor** — Add form (from-dropdown, to-dropdown, symbol-dropdown) + sorted list of existing transitions, each with a delete button
- Dismissible error banner (later replaced by notification system in iter-6)

### 4. Simulate Tab
- When automaton is runnable: shows InputPanel + SimulationControls (from iter-4)
- When not runnable: shows `ValidationView` listing missing transitions / issues

### 5. App-Level Orchestration (`App.tsx`)
- Owns the source-of-truth `automaton: Automaton` state
- Owns `automatonUI` (computed via async GraphViz layout, debounced 120ms with version counter to prevent race conditions)
- Owns `menuState`, `inputString`, `editError`
- Wraps every engine call in `runEdit(...)` for try/catch error surfacing
- Cascade behavior: removing a state cleans up transitions; removing an alphabet symbol filters transitions; any edit resets the simulation; entering Edit tab also resets simulation

### 6. Edit Cycle (the canonical pattern)

```
Click Add → onAddState callback → handleAddState → addState(automaton)
  → setAutomaton(newAutomaton) → React re-renders
  → useEffect: sim.reset() + setInputString('')
  → useEffect: computeLayout(newAutomaton).then(setAutomatonUI)
  → AutomatonCanvas re-renders with new layout
```

This pattern is used for every edit: add/remove state, set start, toggle accept, add/remove transition, alphabet changes, type changes.

---

## Key Design Decisions

### 1. State lives at the lowest component that needs it
- `automaton`, `automatonUI`, `inputString`, `menuState`, `editError` → App
- Simulation internals → `useSimulation` hook
- `draftSymbol`, local `error` → ConfigPanel (no one else needs them)
- `fromState`, `toState`, `symbol` → TransitionEditor (dropdown drafts)

### 2. Discriminated union for ToolMenuState
```typescript
type ToolMenuState =
  | { mode: 'COLLAPSED' }
  | { mode: 'EXPANDED' }
  | { mode: 'OPEN'; activeTab: ToolTabID };
```
Encoding `activeTab` as an optional field on a flat object would let invalid states like `{ mode: 'COLLAPSED', activeTab: 'EDIT' }` be constructed. The union makes those states unrepresentable.

### 3. Form-only editing — canvas stays purely visual
You cannot click the canvas to edit in iter-5. SVG hit detection + drag events + geometric math belong to a future iteration. The canvas is the read-only view of `automaton`.

### 4. Auto-assign on cascade rather than block
Removing the start state → engine reassigns to the lowest-numbered remaining state. Removing an alphabet symbol → App handler filters transitions using it. Better UX than blocking the operation with an error.

### 5. Async layout with version-counted race protection
GraphViz WASM is async. Rapid edits would race; the `layoutVersionRef` counter ensures only the latest call's result commits to `setAutomatonUI`.

### 6. Validation gating without blocking construction
`isRunnable(automaton)` and `getValidationReport(automaton)` are consulted before simulation. The user can build a half-finished automaton without crashing; the Simulate tab simply shows ValidationView until the automaton is runnable.

### 7. JSON export — Sets serialize as arrays
`Automaton` uses `Set<number>` and `Set<string>` internally. Before `JSON.stringify`, the export handler converts every Set to a sorted array. The blob is wrapped in an object URL and a synthetic anchor `click()` triggers the download.

---

## What Works

### Add a state
```typescript
const handleAddState = () => {
  runEdit(() => {
    const { automaton: next } = addState(automaton);
    setAutomaton(next);
  });
};
```

### Set start state
```typescript
const handleSetStartState = (stateId: number) => {
  runEdit(() => setAutomaton(setStartState(automaton, stateId)));
};
```

### Add a transition (with duplicate detection)
```typescript
const handleAddTransition = (from: number, to: number, symbol: string): string | null => {
  try {
    setAutomaton(addTransition(automaton, from, new Set([to]), symbol));
    return null;
  } catch (error) {
    return (error as Error).message;
  }
};
```

### Export to JSON
```typescript
const handleExportJSON = () => {
  const serializable = {
    type: automaton.type,
    states: [...automaton.states].sort(),
    alphabet: [...automaton.alphabet].sort(),
    transitions: automaton.transitions.map(t => ({ ...t, to: [...t.to].sort() })),
    startState: automaton.startState,
    acceptStates: [...automaton.acceptStates].sort(),
    nextStateId: automaton.nextStateId,
  };
  const blob = new Blob([JSON.stringify(serializable, null, 2)], { type: 'application/json' });
  // ... synthetic anchor click ...
};
```

---

## Testing

**Manual testing** — A four-tier checklist exercised every surface:
- **Tier 1 — Happy path**: 3-state navigation, simulate, add state, add transition, toggle accept, set start, add alphabet symbol, export JSON.
- **Tier 2 — Edge cases**: delete last state (blocked), delete last alphabet symbol (blocked), remove state with transitions (cascade), remove alphabet symbol in use (cascade), delete start state (auto-reassign), simulate-tab validation view, duplicate transition error, duplicate alphabet error.
- **Tier 3 — Stress tests**: rapid state adds, rapid alphabet toggles, layout under rapid edits, mode-exclusivity timing.
- **Tier 4 — Hostile**: try to construct invalid states via UI, rapid tab switching during simulation, alphabet with edge characters (`!`, `_`, `#`).

**Automated**: 131 tests carried over from iter-4. No new component tests landed in iter-5 (deferred — flagged in audit as the highest-value follow-up).

---

## File Structure

```
/src
  /components
    /toolMenu                 # NEW: tool menu submodule
      - types.ts              # ToolTabID, ToolTabConfig, ToolMenuState
      - ToolMenu.tsx          # The 3-state sidebar container
      - ConfigPanel.tsx       # Alphabet + type + export
      - EditPanel.tsx         # Composes StateEditor + TransitionEditor + error banner
      - StateEditor.tsx       # Add + per-state CRUD row
      - TransitionEditor.tsx  # Add form + sorted transition list
  - App.tsx                   # REWRITE: source-of-truth state owner, edit handlers, async layout
  - index.css                 # NEW sections: tool menu, editor rows, panels
```

---

## Metrics

- **Tests**: 131 passing (carried over from iter-4)
- **TypeScript**: clean
- **App.tsx growth**: ~370 lines (flagged for future `useToolMenu` extraction if it grows further)
- **Audit**: 2 high-severity bugs fixed before commit; remaining items deferred with documented rationale

---

## Iteration 5 Refinements Applied (Audit)

Findings from the post-implementation codebase audit. Items marked **fixed** were addressed before commit.

### Fixed — Collapsed icon buttons were dead on click
Icon buttons in COLLAPSED mode had no `onClick`. Now clicking an icon opens its tab directly.

### Fixed — Layout race condition on rapid edits
Debounced `computeLayout` didn't guard against out-of-order promise resolution. Added `layoutVersionRef` counter; only the latest call's result commits.

### Fixed — Error banner was keyboard-inaccessible
Banner had `role="button"` but no `onKeyDown`. Added Enter/Space handling.

### Deferred — String literal casing inconsistency
Existing codebase uses lowercase (`'idle'`, `'running'`); iter-5 added uppercase (`'CONFIG'`, `'OPEN'`). Convention going forward: uppercase for tab/mode identifiers, lowercase for status values.

### Deferred — No `useMemo` on sorting operations
`StateEditor` and `TransitionEditor` sort on every render. Negligible at typical scale.

### Deferred — No tests for iter-5 components
Highest-value target: the 3-state ToolMenu FSM. Backfilled in later iterations.

### Deferred — App.tsx is 370+ lines
Candidate for `useToolMenu` extraction if it grows further. (Eventually addressed in iter-11's App.tsx decomposition.)

---

## What's Next: Iteration 6

Notification system — replace every scattered inline error banner (`editError`, TransitionEditor inline, AlphabetEditor) with a global notification store. Notifications stack in the top-right, carry severity, and can highlight the offending source on canvas + in the tool menu.

---

## Lessons Learned

1. **Lift state only when needed** — keeping `draftSymbol` local to ConfigPanel kept App.tsx focused on truly-shared concerns.
2. **Discriminated unions make invalid states unrepresentable** — `ToolMenuState`'s union form prevents nonsense like a collapsed sidebar with an active tab.
3. **Cascade behaviors live where they belong** — engine cascades structural invariants (transitions referencing removed states); App cascades policy (filtering transitions when an alphabet symbol is removed).
4. **Async + rapid input needs version counters** — debouncing alone doesn't prevent the stale-promise-clobbers-fresh-result class of bugs.
5. **Form editing first, canvas editing later** — shipping the form-only path lets every edit work end-to-end; canvas interactions can layer on top without rewriting the form.
6. **Audit before commit** — a structured post-implementation pass catches three high-severity bugs (dead icons, race condition, accessibility gap) that would have shipped otherwise.
