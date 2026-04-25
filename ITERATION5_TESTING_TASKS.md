# Iteration 5 — Manual Testing Tasks

A structured checklist for exercising every surface of the tool menu and editing flow. Work through these in order — they build on each other. Mark ✓ next to passing ones, and note any weirdness.

---

## Tier 1 — Happy path flows (should all "just work")

### 1.1 Three-state navigation basics
1. Load the app. Sidebar should be in COLLAPSED mode (three small icons, vertically centered).
2. Hover over the sidebar. Should expand to show icon + label pills.
3. Move the cursor away (leave the sidebar area). Should collapse back to icons.
4. Hover again, click the "Edit" pill. Should open the submenu with all three tabs visible as cards (Configure compact, Edit expanded showing content, Simulate compact).
5. Click the "Configure" compact card. Should swap — Configure becomes active/expanded, Edit becomes compact.
6. Click the `‹` back button (top of sidebar). Should return to COLLAPSED state.

**Expected**: All transitions smooth, no flicker, no console errors.

### 1.2 Collapsed → open direct (iter-5 fix)
1. From COLLAPSED state, click any of the three icons directly.
2. Should open that tab immediately (skip the expanded hover state).

### 1.3 Read-only simulate (default sample)
1. Open Simulate tab. Input "01". Click Play.
2. Simulation runs, ending at q2 (the accept state). Green "ACCEPTED" banner.
3. Click Back button. Steps backward through simulation.
4. Click on an earlier character in the progress display. Jumps to that point.

### 1.4 Add a state
1. Open Edit tab.
2. Click "+ Add". A new row (q3) should appear.
3. The canvas should re-layout with the new state (after ~120ms debounce).

### 1.5 Add a transition
1. In Edit tab, TRANSITIONS section. Change the three dropdowns to `q0 → q3 → 1`.

   (Note: you'll need a q3 from 1.4, and you'll need to remove the existing `q0 → 1 → q0` transition first, or you'll get a duplicate error.)
2. First remove existing `q0 → 1 → q0` by clicking its trash icon.
3. Now add `q0 → q3 → 1`. Canvas should show a new edge.

### 1.6 Toggle accept state
1. In State list, q2 should already show the filled checkmark (it's an accept state).
2. Click the checkmark to unset it. Canvas: the double-circle around q2 disappears.
3. Click again to re-set. Double circle returns.

### 1.7 Set start state
1. Click the filled "start" dot next to q1. q1 becomes the new start state.
2. Canvas: the start arrow moves to q1.

### 1.8 Add an alphabet symbol
1. Config tab. In the "New symbol" field, type `a`. Press Enter (or click Add).
2. A new `a ×` badge appears.
3. Switch to Edit tab. The Add-transition symbol dropdown now includes `a`.

### 1.9 Export JSON
1. Config tab → Export JSON. Browser downloads `automaton.json`.
2. Open it in a text editor. Verify structure matches the Automaton type (states as array, alphabet as array, transitions with `to` as array, etc.).

---

## Tier 2 — Edge cases (where invariants might bend)

### 2.1 Delete the last state
1. In Edit tab, delete states until only q0 remains.
2. The trash icon next to q0 should be disabled.
3. Hover over it — tooltip reads "Cannot delete last state".

### 2.2 Delete the last alphabet symbol
1. Config tab. Remove symbol `1`. Then try to remove `0`.
2. The `×` on `0` should be disabled (alphabet can't be empty).

### 2.3 Remove a state that has transitions
1. Sample DFA, Edit tab. Delete q1.
2. **Expected**: all transitions involving q1 (both as source and destination) disappear from the list and canvas.

### 2.4 Remove an alphabet symbol that's used
1. Set up: add a transition using symbol `1`.
2. Config tab: remove symbol `1`.
3. **Expected**: transitions using `1` are silently dropped. Edit tab's transition list no longer shows them.

### 2.5 Delete the start state
1. Edit tab. Click trash on q0 (the current start).
2. **Expected**: q0 removed; q1 (or whichever has the lowest remaining ID) becomes the new start state automatically. Canvas start-arrow moves.

### 2.6 Remove an accept state while it's the current simulation state
1. Simulate tab. Run "01" — ends at q2 (accept).
2. Go to Edit tab. (This should reset the simulation.)
3. Unset q2 as accept state. No crash, no weirdness.

### 2.7 Entering Edit resets simulation (mode exclusivity)
1. Simulate tab. Run a simulation partway (step a few times).
2. Click Edit tab. Go back to Simulate.
3. **Expected**: simulation is reset. Input field is empty.

### 2.8 Simulate-tab validation view
1. Edit tab. Delete states until the automaton is incomplete (e.g., delete q1 so some transitions are missing).
2. Switch to Simulate.
3. **Expected**: instead of playback controls, you see a validation view listing missing transitions / issues.
4. Go back to Edit, fix the issues. Simulate should show playback controls again.

### 2.9 Duplicate transition attempt
1. Edit tab. Try to add `q0 → q1 → 0` when it already exists.
2. **Expected**: red error banner appears ("Transition from state 0 on symbol '0' already exists"). Click the banner to dismiss.

### 2.10 Duplicate alphabet symbol
1. Config tab. Try to add symbol `0` (already present).
2. **Expected**: red error text below the input ("'0' is already in the alphabet"). Typing something else clears the error.

### 2.11 Empty/multi-character symbol input
1. Try adding symbol with just spaces (` `).
2. **Expected**: "Symbol cannot be empty" error.
3. (maxLength should block multi-char entry at the input level — hard to even produce.)

### 2.12 Keyboard-only navigation
1. Tab through the interface from the top.
2. **Expected**: all buttons, inputs, and dropdowns reachable. The error banner in Edit (after triggering one) is focusable; Enter/Space dismisses it.

---

## Tier 3 — Stress tests (where async and race conditions hide)

### 3.1 Rapid state adds
1. Click "+ Add" 10 times as fast as you can.
2. **Expected**: 10 new states appear. Canvas doesn't flicker (thanks to the 120ms debounce + version guard).

### 3.2 Rapid alphabet toggles
1. Config tab. Rapidly add and remove symbols (`a`, add, `a`, remove, `b`, add, `b`, remove, etc.).
2. **Expected**: no stuck state, no duplicate badges, no console errors.

### 3.3 Type many characters quickly in symbol input
1. Paste a long string into the New symbol field.
2. **Expected**: maxLength=1 truncates or blocks, error appears.

### 3.4 Delete states while sim is active
1. Simulate tab: run a simulation partway (Play then Pause).
2. Quickly switch to Edit, delete a state that's in the simulation path.
3. **Expected**: simulation resets cleanly. Canvas doesn't show stale highlighting.

### 3.5 Toggle start state back to current start
1. Click the start-state button for a state that isn't current start (to make it start), then immediately click it again (to try to make it start again).
2. **Expected**: second click does nothing — button is disabled because it's already start. No simulation reset happens.

### 3.6 Hover rapidly between tabs
1. In OPEN mode with Config active, rapidly move the mouse between the Config card and the Edit compact card.
2. **Expected**: no flicker, clicks go to the intended target.

### 3.7 Click tab while a different tab is mid-animation
1. Click a compact card. While its expansion is animating, click a different compact card.
2. **Expected**: tab switch is instant; no stuck-halfway rendering.

### 3.8 Layout computation under rapid edits
1. Add a state, immediately delete it, immediately add another, immediately change an accept state — all within ~200ms.
2. **Expected**: canvas eventually settles on the final correct state. No intermediate stale layout visible.

### 3.9 Export an empty-ish automaton
1. Edit tab: delete all transitions, remove all accept states (keep states and alphabet).
2. Config tab: Export JSON.
3. **Expected**: JSON file downloads with empty `transitions: []` and `acceptStates: []`. Re-open it in a text editor to verify.

### 3.10 Switch to Simulate with non-runnable automaton, then immediately switch away
1. Make the automaton incomplete (delete a transition).
2. Switch to Simulate (should show ValidationView).
3. Switch back to Edit before the validation view fully renders.
4. **Expected**: no stale validation banner, no crash.

---

## Tier 4 — "Hostile" tests (try to break it)

### 4.1 Can the user construct an invalid state via the UI?
Try to get the app into a state the engine would reject. Examples to try:
- Add a transition, then remove the destination state, then try to add another transition with the same source/symbol.
- Change type to NFA and back (if possible — UI disables NFA).
- Attempt to type non-printable characters as alphabet symbols (Tab, arrow keys, etc.).

**Expected**: either the UI prevents it, or a visible error appears.

### 4.2 Rapid tab switching during simulation
1. Start a simulation on auto-play (Play in Simulate tab).
2. While playing, click Config → Edit → Simulate → Edit very fast.
3. **Expected**: simulation may reset (mode exclusivity), no crash, no ghost timers firing.

### 4.3 Clear the input mid-simulation
1. Simulate tab. Play a simulation to step 2 of 4.
2. Edit the input string (replace characters).
3. **Expected**: simulation resets; new input, fresh start.

### 4.4 Add transition where from and to are the same state
1. Add `q0 → q0 → 0` (self-loop). Should work — self-loops are valid.
2. Canvas should render a loop.

### 4.5 Alphabet with edge characters
1. Add `!`, `_`, `#` as alphabet symbols. Should all work (single character is the only constraint).
2. Use them in transitions.
3. Simulate with a string using those characters.

### 4.6 Export/reload cycle (manual)
1. Export JSON.
2. Inspect the file — can a human reconstruct the automaton from it?
3. (No import yet — just verify exportability.)

---

## Bug reporting template

For anything that fails: note:
- **What you did** (exact sequence).
- **What you expected**.
- **What happened** (plus screenshot if visual).
- **Console errors** (check DevTools).

Example:
> Task 3.4 (Delete states during sim): after deleting q1 mid-simulation, canvas still shows q1 highlighted blue for ~1 second before disappearing. Expected: immediate reset. No console errors.

---

## After testing

Track what you find — good and bad — so it informs the next iteration. Visual bugs/preferences can wait; correctness bugs should be logged immediately.
