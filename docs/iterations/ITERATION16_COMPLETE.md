# Iteration 16 — NFA → DFA Conversion (Complete)

## What shipped

The headline algorithm. Subset construction with ε-closure handling, exposed as a one-button operation in the Edit panel. Five threads:

1. **Engine** (`src/engine/converter.ts`). `convertNfaToDfa(nfa) → Result<{ dfa, subsetMap }>`. Eager construction over reachable subsets; reuses `epsilonClosure` from `utils.ts`. Trap state created on demand (only when `move(S, a) = ∅` for some pair) with self-loops on every symbol — the resulting DFA always passes `isComplete()`. Three new `EngineError` variants: `conversion-requires-nfa`, `conversion-empty-alphabet`, `conversion-too-large` (1000-subset safety cap).

2. **Engine API contract.** Returns `{ dfa, subsetMap }` where `subsetMap: Map<number, ReadonlySet<number>>` maps each new DFA state ID to the original NFA state subset it represents. Engine stays pure — no labels in the engine layer; the UI generates labels from the subset map.

3. **UI integration.** "Convert to DFA" button on the EDIT panel, shown only when `automaton.type === 'NFA'`. The conversion is dispatched through `setAutomaton` so it lands on the undo stack — pressing ⌘Z reverts to the original NFA, and ⌘⇧Z re-applies. This is the "side-by-side workflow at zero new UI cost" the plan called for.

4. **Subset labels** in the UI. After conversion, DFA state IDs are labeled per subset:
   - Single-element subset `{0}` → `"q0"`
   - Multi-element `{0, 2, 5}` → `"{q0,q2,q5}"` (sorted, comma-joined)
   - Empty (trap) → `"∅"`
   The label override is tied to the *automaton reference* — undoing back to the NFA automatically reverts to default `q{N}` labels because the reference no longer matches the stored conversion.

5. **Sample fixture** + tests. `src/data/sample-nfa.json` holds a textbook NFA recognizing strings ending in `"01"`. 13 new converter tests cover: preconditions (DFA reject, empty-alphabet reject), happy path (DFA accepts the same language as the NFA over a sample input set, completeness invariant, subsetMap contracts, accept-subset rule), edge cases (pure-ε NFA, all-accept NFA, single-state NFA, no-accept NFA, trap created only when needed, trap with self-loops), and a property test (30 random inputs match between NFA and DFA).

Test count: **403 → 416** (+13). All green. `tsc --noEmit` clean.

---

## Phase log

| Phase | Touched | Tests added |
|---|---|---|
| 1 — Engine `convertNfaToDfa` + Result variants | converter.ts + result.ts (3 new variants) | 0 |
| 2 — Tests | converter.test.ts | +13 |
| 3 — UI integration (button + handler + subset labels) | EditPanel.tsx + App.tsx + tool-menu.css | 0 |
| 4 — Sample fixture | sample-nfa.json | 0 |

---

## Design decisions

### Why eager subset construction over reachable subsets

Three options were on the table:
- **Truly lazy** (compute on-demand during simulation): saves memory but defeats the educational goal — users want to *see* the converted DFA.
- **Full powerset** (compute all 2^n subsets): wastes work on unreachable subsets and is exponential even when unnecessary.
- **Eager-from-start** (compute every subset reachable from the NFA's start): the textbook standard, matches what Sipser draws, and the only one that produces a visualizable artifact without exponential blowup.

Picked option 3 — same as every textbook visualizer.

### Subset map as a side table, not labels in engine

CLAUDE.md's "engine owns IDs, UI owns labels" invariant. Stuffing `"{q0,q2}"` into engine state would have broken that. The subset map is structural metadata; the UI consumes it via the existing `displayLabels` mechanism. Engine stays pure.

### Trap state explicit, not implicit

If `move(S, a) = ∅`, the conversion creates a single shared trap state with self-loops on every symbol. **Why explicit:** the result is always a *complete* DFA. `isComplete()` validates. `isRunnable()` returns true. The user can simulate immediately. Implicit completeness ("missing transition = dead end") would make the converted DFA fail `isRunnable()` and confuse anyone who expects "convert" to produce a usable artifact.

The trap is created lazily — only if at least one `(subset, symbol)` pair actually needs it. NFAs whose conversion happens to be total don't get a trap.

### Conversion is undoable, not destructive

Pushing the result through `setAutomaton` lands it on the undo stack. The user can convert / undo / tweak / convert again — that's the side-by-side workflow at zero new UI cost. Building a true two-canvas comparison would have been an iteration of its own (second canvas, second simulator, second undo stack, layout coordination); the undo-as-toggle pattern is 95% of the value at 10% of the cost.

### Subset labels tie to automaton reference

The naïve approach — set subset labels in a stateful Map keyed by state ID — would survive undo, producing wrong labels (the post-undo NFA's state ID 1 would still resolve to `"{q0,q1}"`). Instead, the conversion-labels state stores both the labels *and* the reference of the automaton they apply to. Display logic reads `if (storedRef === currentAutomaton) use subset labels else default`. Reference equality across undo/redo is preserved by `useUndoableAutomaton` (snapshots are pushed/popped by reference), so this just works.

### Why the convert button lives on the EDIT panel (not a new "Operations" tab)

A new tab would have been cleaner long-term — but adds menu surface that's currently used by a single button. When iter-17 ships minimization + complement + equivalence, an Operations tab makes sense; until then, an inline button under the existing TransitionCreator is the lighter touch. The plan flagged this trade-off explicitly.

### Why `'conversion-too-large'` instead of best-effort capping

A pathological NFA could theoretically produce 2^N subsets. Beyond ~1000, dagre slows to a crawl and the layout becomes unreadable anyway. Refusing with a typed error ("conversion produced more states than the safety cap allows") is honest — the user knows what happened and can simplify their NFA, rather than waiting for a frozen browser. Cap is exposed as `CONVERSION_MAX_SUBSETS` for tests.

---

## What stayed the same

- Every other engine semantic.
- All UI behavior outside the new convert button.
- All animations.
- The pre-existing simulator handles the converted DFA without modification (it's just a complete DFA — a known case).

---

## Out of scope / deferred

- **DFA minimization** (Hopcroft) — iter-17.
- **Complement** (one-liner once conversion guarantees completeness) — iter-17.
- **Equivalence testing** (product construction) — iter-18.
- **Step-by-step animated construction** — iter-20 per the customer brainstorm.
- **True side-by-side dual-canvas comparison** — iteration of its own, gated on user demand.
- **Ambiguity highlighting** for the source NFA (showing which states/transitions caused non-determinism) — opportunistic backlog.
- **Operations tab** — lands when iter-17 adds the second + third operation buttons.
- **Sample-NFA loader from File panel** — sample-nfa.json exists but is a reference file; no loader yet (recents only contains user-saved files). Iter-17+.

---

## Browser verification recommended

Wes should verify on next browser session:
1. **Convert flow** — switch to NFA mode in Configure; open Edit; build (or paste) a small NFA; click "Convert to DFA"; see the new DFA replace the canvas with subset labels.
2. **Undo conversion** — ⌘Z reverts to NFA. ⌘⇧Z re-applies. Subset labels should be present only on the converted snapshot.
3. **Trap-state behavior** — convert an NFA with a missing transition; verify the resulting DFA has a `∅` state with self-loops, simulation stays in trap forever.
4. **Edge cases** — try the pure-ε NFA, single-state NFA, all-accept NFA from the test fixtures.

---

## How to run

```bash
cd /Users/wesorr/Documents/Projects/Project\ Automata/.claude/worktrees/iter-12
npm test -- --run            # 416 passing
npx tsc --noEmit             # clean
npm run dev                  # browser verification
```
