# Iteration 8 — NFA Support

## Why this iteration exists

The engine's data model has supported NFA shapes from day one (`to: Set<number>` per transition, `symbol: string | null` allowing ε), but the validator, simulator, editor, and renderer all assume DFA semantics. This iteration lights up the NFA path: parallel execution of multiple active states, ε-closure, multi-destination edges, and the visual + editor changes that make non-deterministic structure intelligible.

The Configure tab already exposes a DFA / NFA toggle. Today flipping it changes the engine's `type` field but nothing else behaves differently. After this iteration, NFA mode is a real mode.

---

## Goals

1. **Engine**: validator and simulator handle NFA semantics correctly.
   - Multi-destination transitions allowed in NFA mode.
   - ε-transitions allowed and respected (closure on initialization, after each step).
   - DFA mode still rejects both.

2. **Editor**:
   - In the transition symbol box, the configured **reserved ε symbol** (default `e`) authors an ε-transition (engine `symbol: null`).
   - The reserved symbol is forbidden as an alphabet symbol — surfaced via the notification system with text like *"'e' is reserved for ε-transitions in NFA mode."*
   - The reserved symbol is **configurable** in the Configure tab — single-character input, defaults to `e`. Stored in UI state (not the engine model). Persisted in JSON export under a top-level `ui.epsilonSymbol` field so reloads preserve the choice.
   - Comma-separated symbols in the symbol box (e.g. `a, b`) commit multiple transitions in one action — same source, same destination, one per symbol.
   - In NFA mode, adding `(q0, a, q2)` when `(q0, a, q1)` already exists *adds a second destination* instead of warning about overwrite.

3. **Visualization**:
   - Edge consolidation: when two or more transitions share the same `from` AND same `to`, render as a single arrow with a comma-separated label (e.g. `a, b, ε`). Applies in BOTH DFA and NFA modes — DFA users benefit too (e.g. `q0 → q1` on either `0` or `1` becomes one arrow labeled `0, 1`).
   - Multi-destination NFA transitions are NOT consolidated — different destinations are different arrows.
   - ε-transitions render with a solid edge (per user) and label `ε`.

4. **DFA / NFA toggle**:
   - User may flip freely. NFA → DFA on a non-DFA-compatible automaton produces validation errors that block simulation but don't destroy data.
   - Flipping back to NFA clears those errors automatically.
   - NFA → DFA *conversion* (subset construction) is OUT OF SCOPE — deferred to iteration 10 backlog. Toggle is a type assertion only, not a transformation.

5. **Simulation**:
   - Multiple active states highlighted simultaneously in the existing blue.
   - No per-branch UI yet (future iteration may add branch trees / tabs).

---

## Engine changes

### `validator.ts`
- `isDFA(automaton)` already exists — keep, it's the predicate used by the new flow.
- New / updated checks needed:
  - `hasMultipleDestinations(automaton)` — any transition with `to.size > 1`.
  - `hasEpsilonTransitions(automaton)` — any transition with `symbol === null`.
  - `hasMissingTransitions(automaton)` — DFA-only completeness check (already exists as `isComplete`).
  - `getValidationReport(automaton)` — branch on `automaton.type`. In DFA mode, multi-dest and ε are errors. In NFA mode, neither is an error; missing transitions become a warning (not blocking).
- `isRunnable(automaton)` — DFA needs to be complete; NFA needs at least a start state, alphabet, and one transition.

### `simulator.ts`
- Replace `currentState: number` with `currentStateIds: Set<number>` throughout the simulation type.
- New helper: `epsilonClosure(states, transitions): Set<number>` — BFS over ε-transitions.
- `step` becomes:
  ```
  next = ∅
  for each state in current:
    for each transition (state, symbol = inputChar): next.add(...transition.to)
  next = epsilonClosure(next, transitions)
  ```
- Initialization applies ε-closure to `{startState}`.
- Acceptance: any state in `currentStateIds ∩ acceptStates` → accepted.
- DFA simulations remain a special case where `currentStateIds.size === 1`.

### `automaton.ts`
- New primitive: `addTransitionDestination(automaton, from, symbol, newDest)` — appends to existing `to` set if a matching transition exists, else creates a new transition. Use this for the NFA "add second destination" path.
- Existing `addTransition` (which replaces by `from + symbol`) stays for DFA mode.
- New primitive: `removeTransitionDestination(automaton, from, symbol, dest)` — removes one dest from a transition's `to` set. If `to` becomes empty, removes the transition record.

### Tests
- New test files / sections for ε-closure, multi-state simulation, NFA validator branching, and the new automaton primitives. Existing 169 tests should all still pass with no semantic change.

---

## Editor changes

### Symbol input parsing
- Single character → single transition (existing behavior).
- `e` → ε-transition (`symbol: null`).
- Comma-separated (e.g. `a, b, c`) → split, trim, validate each, then commit as a batch.
- Validation: each token must be either `e` (ε) or a single character that's in the alphabet.
- Placeholder: today shows missing symbols. Stays the same — comma-separated input is power-user, the placeholder doesn't need to advertise it.

### Add / Modify / Delete in NFA mode
- **Add** (no editingExisting): for each parsed symbol, call `addTransitionDestination` instead of `addTransition`. The "would overwrite" warning is suppressed in NFA mode.
- **Modify** (editingExisting set): when the user clicks a consolidated edge (one or more symbols sharing the same `from` and `to`):
  - The mini-SVG renders the edge identically to the canvas — same source, same destination, comma-separated symbols in the symbol box.
  - The form treats the edge as a unit. Modify re-parses the symbol box's comma-separated list and replaces the whole group: every prior symbol on that `(from, to)` is removed, the new ones are added.
  - Delete removes every transition in the group.
- For multi-destination transitions, clicking one of the rendered edges loads only that destination (we don't conflate visually-distinct edges).

### Reserved-`e` (configurable) rule
- New `epsilonSymbol: string` in UI state (App.tsx), default `'e'`. The Configure tab gets a small input to change it: single character, can't be empty, can't already be in the alphabet (validation on change).
- When the user tries to add the reserved symbol to the alphabet, the alphabet editor calls `notify({ severity: 'error', title: \`'\${epsilonSymbol}' is reserved for ε-transitions.\`, ... })` and rejects the add.
- On JSON load, if the stored alphabet contains the reserved symbol, surface a notification and refuse to load — leave the user the option to change the reserved symbol first or edit the file.
- On JSON export, include `ui.epsilonSymbol` so re-import is consistent.

---

## Visual changes

### Edge consolidation
- Pre-layout step: walk transitions, group by `(from, to)`, fold same-direction-same-endpoint records into one DOT edge with a joined label.
- Joined label format: `a, b, ε` (sorted, ε last).
- When the canvas-clicked edge is a consolidated one, the click handler dispatches `loadExisting` with the joined symbol string so the editor renders it accurately.
- Multi-destination is unaffected — different `to` means different DOT edges.

### ε-transition rendering
- Solid edge (same as everything else).
- Label literally `ε`.
- No special color — the `ε` glyph carries the meaning.

### Active-state highlight in simulation
- Existing `isActive` blue applied to every state in `currentStateIds`.
- `nextTransition` highlight generalizes to *all possible* next transitions: any edge `(state, symbol = inputChar)` where `state ∈ currentStateIds` and `symbol` matches the next input character. All of those edges glow blue. Same affordance as DFA — user sees what's about to fire — just possibly several at once.
- Implementation: rename `nextTransition` to `nextTransitions: ReadonlyArray<...>` (or a Set keyed by from/to/symbol) in the simulation hook + canvas props.

### Branch-death pulse
When the NFA steps and some currently-active states have no transition for the input symbol, those states "die" — they don't survive into the next active set. Visualize this by briefly pulsing them red before they go fully inactive, so the user sees branches winding down in real time.

- **Detection**: each step computes `dyingStates = currentStateIds \ nextStateIds` (after applying the symbol but BEFORE the post-step ε-closure, so we only count states that genuinely had no transition).
- **Visual**: each dying state gets a `state-dying` class for a short window (~700ms — same cadence as the existing pulse keyframes). The class triggers a one-shot `animation: pulse-die` keyframe — stroke transitions from active blue → red → fades opacity to inactive default.
- **Implementation**: `useSimulation` exposes `dyingStateIds: ReadonlySet<number>` that's set by `step` and cleared by a `setTimeout` after the animation duration. Canvas reads it and adds the class to matching states. Cleared on reset / step-back too.
- **DFA case**: same mechanism applies — when a DFA hits a dead-end (no transition for the symbol), the active state dies. Single state pulses red and the simulation finishes as rejected. Free behavior, same code path.

---

## Phases

Each phase ends with: tests pass + typecheck clean + browser-verified + commit.

**Phase 1 — Engine foundations**
- ε-closure helper + tests.
- Simulator refactor: `currentStateIds` everywhere, multi-state step, ε-closure on init/step.
- All existing DFA tests still pass (single-element-Set is equivalent).

**Phase 2 — Engine validator + new primitives**
- Validator branches on `automaton.type`.
- `addTransitionDestination`, `removeTransitionDestination`.
- `isRunnable` updated.
- Reserved-`e` enforcement in alphabet add path.

**Phase 3 — Edge consolidation in the renderer (DFA + NFA)**
- DOT generation groups same-`(from, to)` transitions into one edge with a comma-joined label.
- Layout output parsing maps each consolidated edge back to its constituent transitions for click handling — the canvas needs to know which underlying transitions a clicked edge represents.
- ε labeled correctly (`ε`).
- Verifies in DFA mode first (no NFA work yet) so the consolidation is provable on its own.

**Phase 4 — Editor: ε input + comma-separated symbols + NFA add semantics**
- Symbol parser handles `e` and comma-separated.
- NFA mode uses `addTransitionDestination`; "overwrite" warning becomes "additional destination" indicator (or nothing — suppressed).
- Loading a consolidated edge populates the form with joined symbols.

**Phase 5 — Simulation visual + Simulate-tab gating**
- All active states highlighted blue.
- `nextTransitions` (plural): every possible next transition glows blue, both DFA (still 0–1) and NFA (0–N).
- Branch-death pulse: dying states animate red briefly on each step.
- Simulate tab respects updated `isRunnable`.

**Phase 6 — Polish + handoff**
- Audit for visual edge cases (many ε self-loops, very dense NFAs).
- Update CLAUDE.md, ARCHITECTURAL_PATTERNS.md.
- Write ITERATION8_COMPLETE.md.
- Update NEXT_SESSION_HANDOFF.md.

---

## Decisions still open

None right now — all settled. If something surfaces during a phase, raise it inline.

---

## Out of scope (deferred)

- NFA → DFA conversion (subset construction).
- Branch-tree / per-branch simulation UI.
- Pseudo-`?` state for incomplete DFAs (separate handoff item).
- Code/terminal panel for programmatic authoring (separate handoff item).
- Undo/redo (was originally going to be iter 8 — pushed to iter 9 or later).
