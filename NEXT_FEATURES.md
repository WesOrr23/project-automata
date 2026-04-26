# Next Features

> Sorted by my read of impact-vs-cost. Three buckets: do-soon, big-features, polish-as-we-go.

## Tier 1 — Do soon (1–2 iterations each)

### 1. Operations widget (iter-17)
Per `ADVANCED_OPS_BRAINSTORM.md`. Single icon button top-center → popover menu of operations. Convert to DFA moves into it. Foundation for everything else in Tier 2.

### 2. DFA Minimization (Hopcroft) + Complement
Complement is a one-liner once DFA is complete (which Convert guarantees). Hopcroft is well-defined and textbook. Both go in the Operations widget.

### 3. Equivalence checking (product construction)
"Is my answer equivalent to this reference?" Power-user value for Selene-persona. Needs a second-automaton picker — the file widget's recents list could be the source.

### 4. Regex → NFA (Thompson's construction)
The other half of the conversion pipeline. Big educational value. Needs a regex parser (manageable: limited grammar) + Thompson's construction (textbook). Adds a new entry path on the File widget ("New from regex…").

### 5. Step-by-step algorithm visualization
Show subset construction *as it happens*. Worklist, current subset, new edges added live. Pairs with Convert + Minimize. The visual payoff for the educational mission.

## Tier 2 — Big features (3–5 iterations each)

### 6. Tape view + simulation timeline
Currently the simulation shows the *automaton* but not the *input string in motion*. Tape view: input string laid out as cells with a cursor on the current symbol. Pairs with a horizontal scrubber for jumping anywhere in the simulation history.

### 7. Image export (PNG / SVG)
Critical for "Maya turns this in for homework." Operations widget item. Inline computed styles into the SVG, serialize, offer download. Quietly important.

### 8. Shareable URL
Compress the current automaton into the URL hash so a paste = a working FA. Requires gzip + base64. ~300 lines. High persona impact for Luca/Maya.

### 9. Real file save-in-place (FS Access API)
Right now Save = re-download the file. For Chromium users, FS Access API would persist the file handle so subsequent Saves overwrite the original. Iteration 15 deferred this; pick it back up.

### 10. Algorithm trace UI
Generalization of #5 for any iterative algorithm: minimization, equivalence (product), regex compilation. A reusable "step trace" data structure + playback controls.

## Tier 3 — Polish as we go (sub-iteration / inline)

### 11. Drop the `1:1` zoom button
Per our previous chat: it's borderline meaningless in this app. Just keep `+` / `−` / Fit. Saves a button and reduces decision load.

### 12. ⌘K command palette
Once there are 8+ commands across all widgets. Fuzzy-searchable palette over all file ops, edit ops, operations.

### 13. Right-click context menus
On states: "Set as start", "Toggle accept", "Delete". On edges: "Edit", "Delete". On empty canvas: "New state here". Power-user pattern; doesn't replace existing surfaces.

### 14. Auto-save snapshots
Save to localStorage on every meaningful edit. On load, offer "Restore from N minutes ago". Recovery for browser-crash and unsaved work.

### 15. Reduced-motion media query
Deferred since iter-10. Suspend breathing keyframes; shorten transitions to ~100ms. ~30 lines.

### 16. Test-utils extraction
RTL fixtures (mock automaton, render helper) duplicated across 5+ component test files now. Extract a shared `test-utils/automatonFixtures.ts`.

### 17. Sample library / starter automatons
Iter-15 added recents but no library. A "Samples" submenu inside the file widget's `⋯` popover with built-in fixtures (DFA, NFA, ε-NFA, the Sipser examples).

### 18. Keyboard-only editing
Add states / set start / mark accept / add transition — all from keys. Power-user mode. Probably 2 days of work; nice-to-have.

### 19. δ-table view
Toggle between graph view and δ-table view. For students who think in tables. Lives as a toggle on the canvas (icon button bottom-left?).

### 20. Notification highlights at zoomed scale (audit-bug)
Not currently broken (per iter-14 finding) but worth a re-test now that pan-zoom changed. If popovers/highlights drift at scale, the `worldToScreen` helper from the iter-14 plan is the fix.

## Suggested next-iteration ordering

1. **Iter-17**: Operations widget (#1) + Drop 1:1 (#11) + start of DFA minimization (#2 partial).
2. **Iter-18**: Finish minimization + complement (#2) + equivalence (#3).
3. **Iter-19**: Regex → NFA (#4).
4. **Iter-20**: Step-by-step viz (#5) — applies retroactively to convert/minimize.
5. **Iter-21**: Image export (#7).
6. **Iter-22**: Tape view (#6).
7. **Iter-23**: Shareable URL (#8) + FS Access API (#9).

Polish items (#11, #13, #14, #15, #20) ride along during whichever iteration touches the relevant area.
