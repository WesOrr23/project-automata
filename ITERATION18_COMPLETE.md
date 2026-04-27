# Iteration 18 — DFA Equivalence + Compare Picker (Complete)

## What shipped

The educational gold for the Selene-persona ("did I get this textbook exercise right?"). Three threads:

1. **`areEquivalent` engine function** in new `src/engine/equivalence.ts`. Product-construction BFS over (a × b) state pairs. A pair is "diff" iff exactly one of (qa∈A.accept, qb∈B.accept) holds. BFS guarantees the SHORTEST counterexample by construction. Returns `{ equivalent: true, counterexample: null }` or `{ equivalent: false, counterexample: string, acceptingSide: 'a' | 'b' }`. Refuses NFAs (`'equivalence-requires-dfa'`), incomplete DFAs (`'equivalence-requires-complete-dfa'`), and alphabet mismatches (`'equivalence-alphabet-mismatch'`).

2. **`ComparePicker` component** — popover dialog opened from the Operations widget's new "Compare against…" item. Lists every recent file (parsed on demand and validated). Loadable entries (DFA + complete + matching alphabet) are clickable; non-loadable entries render as disabled buttons with the reason ("Not a DFA" / "Incomplete DFA" / "Different alphabet" / parse-error message). Plus an "Open another file…" button that triggers the standard file-adapter open flow with the same validation.

3. **Result UX** via the existing notification system. **Equivalent** → green success notification ("Equivalent ✓ — These automatons accept the same language as <name>") with a 6s dismiss. **Not equivalent** → red error notification ("Not equivalent ✗ — Counterexample: <ce> — accepted by <side> but rejected by <other>") with a 10s dismiss so the user can copy/study the counterexample. Empty-string counterexamples are rendered as "ε (empty string)" rather than `""`.

Tests: **450 → 470** (+8 equivalence engine, +12 ComparePicker RTL). All green. `tsc --noEmit` clean.

---

## Phase log

| Phase | Touched | Tests added |
|---|---|---|
| 1 — `areEquivalent` engine + 3 new error variants | equivalence.ts + result.ts | +8 |
| 2 — `ComparePicker` component + CSS | ComparePicker.tsx + simulation.css | 0 |
| 3 — App.tsx wiring (state, handler, menu item, render) | App.tsx | 0 |
| 4 — RTL tests for ComparePicker | ComparePicker.test.tsx | +12 |

---

## Design decisions

### Why product construction (not a "minimize then compare canonical form" approach)
Both work; product construction has the killer benefit: when the answer is "no," you get a counterexample for free as a byproduct of the BFS. Minimize-then-compare would tell the student "wrong" without telling them WHERE it's wrong. For an educational tool that's a strict downgrade.

### BFS guarantees the SHORTEST counterexample
Tested explicitly (the `lenMod2 vs lenMod3` fixture: shortest counter is `"00"`, not the trivially-true `"000000"`). Shortest counterexamples are dramatically more useful for a student trying to understand "what string distinguishes my answer from the reference."

### `acceptingSide` in the outcome
Without this, the UI couldn't phrase the result accurately — "X accepts but Y rejects" requires knowing WHICH side accepts. Equally cheap to compute alongside the counterexample; saves the UI a redundant `accepts(a, ce)` call.

### ComparePicker as a popover, not a modal
Modals interrupt; popovers float. The user is in a flow ("compare my work against the reference") and a popover keeps the canvas visible underneath so they can sanity-check what they're comparing.

### Show non-loadable recents (disabled with reason) rather than hiding them
Initial implementation hid all-non-loadable lists with a single "no matching files" message. Better to show them as disabled with the specific reason ("Not a DFA", "Different alphabet"); the user learns *why* a file can't be compared, which is itself useful information when building toward a working comparison set.

### File adapter passed in (not imported)
Lets RTL tests pass a stub adapter (`open` returns `cancelled` immediately) without spying on a module-level singleton. Same pattern `useFileSession` already uses.

### No "send counterexample to simulator" auto-action (yet)
Considered. Not added in this iteration because it requires routing a string into the input panel from outside the SIMULATE tab, plus a tab-switch — a UX flow worth its own design pass. The notification's 10s dismiss gives the user time to read and copy the counterexample manually for now.

---

## What stayed the same
- All other operations (Convert, Minimize, Complement) and their semantics.
- File ops (save, load, recents) — only added a new READ path on the recents store.
- Undo/redo — equivalence is read-only, doesn't push onto history.
- CommandBar, tool menu, zoom, all other chrome.

---

## Out of scope / deferred
- **"Test counterexample in simulator"** auto-action — needs cross-tab state routing.
- **Side-by-side dual-canvas view** for comparing the two automatons visually — substantial UX work; deferred until demand emerges.
- **Test-case bundle equivalence** (file format has `testCases` but the editor doesn't surface them) — iter-19+.
- **Three-way+ comparison** — pairwise only.
- **Closure operations** (union, intersection of languages) — iter-19+ if demanded.

---

## How to run
```bash
cd /Users/wesorr/Documents/Projects/Project Automata/.claude/worktrees/iter-12
npm test -- --run            # 470 passing
npx tsc --noEmit             # clean
npm run dev                  # browser at http://localhost:5181
```

In the browser:
1. Switch to EDIT mode → Wand icon visible next to CommandBar.
2. Click Wand → popover with Conversions + Analysis.
3. The Analysis section now has "Compare against…" alongside "Minimize DFA". Both gated on DFA + complete.
4. Click Compare → ComparePicker dialog appears with recents + "Open another file…".
5. Save the current automaton via the file widget so it shows up as a recent (or open another file directly).
6. Pick a comparison target → notification fires:
   - Same automaton → green "Equivalent ✓"
   - Different language → red "Not equivalent ✗" with the shortest counterexample.

---

## Wrap-up — iter-13 through iter-18

This closes out the planned arc:
- iter-13: audit cleanup
- iter-14: viewport clamp
- iter-15: file save/load + recents
- iter-16: NFA → DFA conversion (with auto-minimize)
- iter-17: Operations widget + complement + state-centric centering + drop 1:1
- iter-18: equivalence + compare picker

The Operations widget now has 4 items across 2 categories. The user can build an automaton, test it, save it, convert it (NFA→DFA), minimize it, complement it, and compare it to a reference — covering the educational core. Next-iteration choices live in `NEXT_FEATURES.md` (image export, shareable URL, FS Access save-in-place are the top remaining items).
