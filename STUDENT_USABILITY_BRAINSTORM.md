# What's Missing for a Student to Truly Use This?

> Not a feature wish-list. A walk-through of "Maya, second-year CS undergrad, two weeks into Automata Theory" actually trying to use the tool for her homework. Where does she hit friction? Where does she give up?

## Maya's session — the honest play-through

It's Sunday night. Maya opens the tool. The homework is from Sipser §1.2 problem set: "Construct DFAs that recognize each of the following languages over {a, b}: (a) strings ending in `b`; (b) strings of length ≥ 3; (c) strings where every `a` is followed by a `b`."

She wants to do all three, save them as separate files, hand them in.

## Friction points (ranked by severity)

### TIER 1 — She gives up here

**1. There is no way to know how to do anything.**
Maya opens the tool. There's a tool menu on the left with three icons. There's a thin bar at the top with file icons. She doesn't know what the tabs do. She doesn't know what a "ε-symbol" means even though we surface it in the configure tab. **There is no onboarding, no first-time tour, no "click here to start" guidance.** She closes the tab.

*Fix: a one-time first-launch overlay that points at each major UI element with a 2-3-word label. "Configure your alphabet → Edit states & transitions → Test by simulating." Plus a "Help" / "?" button somewhere persistent that re-shows it.*

**2. The simulator can't tell her what's wrong.**
She builds a DFA she thinks is correct. Switches to Simulate. Types `aab`. Watches it animate. It says "Rejected." She believes it should be Accepted. She has no idea WHY it rejected, no debugging affordance beyond "step through manually." **For an FA with 5+ states this is brutal — she has to trace the path mentally because we don't tell her the winning/losing transition path.** She switches to a textbook diagram and gives up on us.

*Fix: after simulation, surface the path as a sequence: `q0 --a--> q1 --a--> q1 --b--> q2 (reject — q2 is not accepting)`. Display in the SIMULATE tab below the result banner. Highlight the path on the canvas (already half-done — the firedTransitions state exists).*

**3. Validation messages are too late.**
She tries to simulate before adding all the alphabet's transitions. Tool says "DFA is incomplete — add the missing transitions to simulate." OK, but **WHICH transitions?** She has 5 states × 2 symbols = 10 needed. She has to mentally diff. She gives up and wings it.

*Fix: when isComplete fails, list the missing (state, symbol) pairs explicitly. Bonus: clicking one in the validator panel highlights the offending state on the canvas.*

### TIER 2 — She powers through but resents us

**4. There is no test-string library / batch testing.**
She has the homework's expected accept-strings (`b`, `abb`, `aab`) and reject-strings (`a`, `aa`, `ba`). She has to type each one in, simulate, write down the result, type the next, simulate, write it down. **She wants to paste in a list of strings and see ✓/✗ next to each.** Especially for "(c) every `a` is followed by a `b`" where she needs to test 8+ strings to be confident.

*Fix: the file format already has `testCases: { accept: [], reject: [] }`. Surface this in the SIMULATE tab as an editable list with a "Run all" button that batch-checks each string against the current automaton, showing ✓/✗ per row. Persists with the file.*

**5. There's no way to print, export an image, or hand anything in.**
Her homework requires a diagram embedded in a PDF. The tool has no PNG export, no PDF export, no print stylesheet. She screenshots the canvas with the menu in the way, crops it in Preview, and curses us.

*Fix: add an "Export" item under Operations: Export as PNG (via SVG → Canvas → toDataURL), Export as SVG (serialize the content `<g>` with inlined computed styles).*

**6. She can't tell the simulator to keep going.**
She steps through. After step 3 she clicks Step three more times. She's missed checking what was happening at step 2. **No history scrubber.** She has to reset and start over.

*Fix: a horizontal scrubber under the SIMULATE tab showing the input string with a marker at the current position. Clickable to jump.*

### TIER 3 — Power features she'd use after the first homework

**7. She can't easily compare her answer to the textbook's.**
We added "Compare against…" in iter-18. But to USE it she has to: build her version, save it, go look up the textbook's, build IT in the tool, save it, switch back to her version, click Compare, pick the saved one. **Six steps for one comparison.** No way to import the textbook's answer except by hand.

*Fix-A (small): an "Import sample DFAs" library bundled with the tool — Sipser examples, common languages (`a*b*`, `(ab)*`, divisible by 3). User loads the textbook one in two clicks, then compares.*
*Fix-B (small): equivalence side-by-side. Don't just notify "not equivalent — counterexample X"; offer "Test this string in both" or open a side panel showing the trace through both.*

**8. She can't share her answer.**
She wants to send her DFA to her study partner ("does this look right?"). Today she'd save the JSON file and email it. **Friction.**

*Fix: shareable URL (compress automaton into URL hash). One click → URL copied → paste in iMessage/Discord. Already in NEXT_FEATURES.md as iter-19; it's even more important than I thought because it accelerates peer learning, not just personal storage.*

**9. There's no way to "show her work."**
The professor wants to see her thinking, not just the final DFA. **A static diagram doesn't show that.** She'd love to record the construction as a GIF or have a "trace mode" that lets her annotate which transitions she added and why.

*Fix: defer (heavy lift). But "Export as GIF (animated step-through)" is a killer feature when iter-21's tape view + step-through visualization lands.*

### TIER 4 — Polish/ergonomics

**10. Adding states is OK but tedious for big automatons.**
For a 10-state DFA, she clicks "+ Add" 10 times, sets each name, sets accept on the right ones, sets start, then adds 20 transitions through the form. **Click-fatigue.**

*Fix-A: keyboard shortcut "Add state" (e.g. `s`). Auto-name the new state.*
*Fix-B: click-on-empty-canvas-to-create-state mode. Toggle in the EDIT panel.*
*Fix-C: drag a transition from one state to another (instead of using the form).*

**11. Self-loops are awkward to add.**
The transition form requires picking source = destination, which she does by clicking the same state twice. **Not obvious.**

*Fix: when she's picked source and the destination popover opens, the source state should appear as a special highlighted option labeled "(self-loop)".*

**12. The configure tab feels lonely.**
Alphabet, type, ε-symbol — three settings, all on one tab, surrounded by white space. Feels like a placeholder. She might miss it entirely.

*Fix: when alphabet is empty, show a CONFIGURE-tab nudge ("Add some symbols here first →"). This is also a path to fixing onboarding (#1).*

**13. There's no clear distinction between her-saved-files and built-in-samples.**
Recents only shows files she's opened. The "Import sample DFAs" library (#7-A) needs its own surface — maybe under the ⋯ overflow as "Open sample…".

**14. The notification toasts disappear too fast for messages she needs to read.**
The "counterexample: aab" notification dismisses after 10s. If she's mid-thought, she misses it. **No way to recall recently-dismissed toasts.**

*Fix: persistent notification log (collapsible drawer) showing the last N notifications.*

**15. Small things**:
- No way to jump to a specific state by its label (with 10 states, finding "q7" requires hunting).
- No way to delete a transition from the canvas (must use the form).
- The "alphabet" requires single characters; some textbooks use multi-char alphabets like `{0, 1, EOF}`.

### TIER 5 — Things that aren't broken but would feel pro

**16. Dark mode.**
**17. Pinch-to-zoom hint (the canvas-tip hints at clicking but not zooming).**
**18. Mobile/tablet support** (out of scope — drawing automatons on a phone isn't real).
**19. Versioned undo history viewer** ("show me what changed between snapshots N and N+1").
**20. Auto-save snapshots** to localStorage so a browser crash doesn't lose her work.

---

## What I'd build next (concrete recommendations)

Picking three iterations that would each move multiple Tier-1/2 items off the list:

### Proposed iter-19 — Simulator Insight + Validator Specifics
Tackles #2 (no idea why it rejected), #3 (incomplete-DFA without details), #6 (history scrubber).
- After-simulation transition path display + canvas highlight reuse.
- Validator: list missing (state, symbol) pairs; click to highlight.
- SimulationControls scrubber with jump-to-step.
- Estimated 1 iteration.

### Proposed iter-20 — Test Cases + Built-in Samples + Image Export
Tackles #4 (batch testing), #5 (export), #7-A (sample library), #13 (samples surface).
- Surface the file format's `testCases` array in the SIMULATE tab as an editable list with batch ✓/✗ display.
- "Open sample…" item in CommandBar's ⋯ menu, populated from a bundled `src/data/samples/` directory.
- Operations widget gains "Export → PNG" and "Export → SVG" entries.
- Estimated 1 iteration.

### Proposed iter-21 — Onboarding + Shareable URL
Tackles #1 (no onboarding), #8 (sharing).
- First-launch overlay (dismissible, persistent dismissal in localStorage) pointing at the three key UI areas.
- "?" help button somewhere persistent that re-shows the tour.
- Shareable URL: compress + base64 the current automaton into the URL hash; share button copies the URL; auto-load on hash present.
- Estimated 1 iteration.

After those three, the tool becomes credible as a homework companion. Maya would actually stay through her assignment, hand in a real-looking diagram, and tell two friends about it. That's the bar.

## What stays out of scope

- Mobile/tablet input (different problem).
- Cloud accounts / sync (no backend, by design).
- Pushdown automata or Turing machines (different machine class).
- Regex → NFA (Wes excluded).
- Algorithm step-through visualization (Wes excluded).
- Tape view (Wes excluded).
