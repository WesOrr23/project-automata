# Planning

Forward-looking notes for the project: what's next, how we work, what's deferred, and what to test with users. Replaces the previous four-document split (FUTURE_ITERATIONS / NEXT_FEATURES / NEXT_SESSION_HANDOFF / USER_TESTING_TASKS) — one canonical file is easier to keep current.

> **Currency.** This file is opinion + intent, not status. For "what shipped when," read `docs/iterations/`. For "current state of the codebase," read `CLAUDE.md`.

---

## 1. Working style

Conventions established over iterations 1–18, captured for whoever opens the next session.

### Iteration discipline

- Every iteration starts with a plan written to `docs/iterations/ITERATION{N}_IN_PROGRESS.md`.
- Iteration ends with that file renamed to `ITERATION{N}_COMPLETE.md` and rewritten to mirror the structure of `ITERATION1_COMPLETE.md`.
- Phases inside an iteration get their own commits.
- Tests + typecheck + visual verify before each commit.
- One thing at a time. Don't refactor scope you weren't asked to refactor.

### Mode preferences

- **Mentor mode** (`/mentor`) — used while actively learning. Wes writes the code; the assistant explains concepts and walks through decisions without writing code. Reference `~/.claude/rules/mentor-mode.md`.
- **Execution mode** — default. Auto-mode active. Assistant writes code, commits per phase, runs tests, screenshots to verify.
- The default is execution. Switch to mentor only when explicitly invoked.

### What Wes values

- **The #1 rule:** the tool menu (Define / Construct / Simulate cards) must always fit the viewport. Active card scrolls internally; compact cards stay visible. Don't break this.
- **Discoverable UX over clever shortcuts.** Disabled buttons with explanatory text > buttons that change label.
- **Direct manipulation of visuals.** Canvas-first editing, not table-based.
- **Honest feedback.** Push back with concrete reasoning rather than appeasing.
- **Architectural patterns documented as we go.** `docs/reference/ARCHITECTURAL_PATTERNS.md` grows with each iteration.

### What Wes dislikes

- Yellow as a UI color (Modify is violet).
- Layouts that grow infinitely without bounds.
- Modal popups that overlap content they're meant to interact with.
- Excessive cleverness when a simple approach would do.
- Sycophancy / flattery.

---

## 2. Roadmap

Loose ordering — pick whichever fits the moment, but the top items are the strongest fits given current state.

### Tier 1 — Next 1–2 iterations

**Regex → NFA (Thompson's construction).** Closes the conversion pipeline (with NFA→DFA from iter-16 and minimization from iter-17). Educational payoff for any "go from a regex all the way to its minimal DFA" use case.
- Subset of POSIX-extended grammar: union (`|`), concat, Kleene star (`*`), `+`, `?`, `()`, `[abc]`, `[a-z]`, `\.`. Explicitly NOT: backreferences, lookahead/behind, anchors, named groups.
- Thompson's construction: each AST node becomes a small NFA fragment; concat/union/star wire fragments via ε-transitions.
- UI: new "From regex" entry point. Live preview of the constructed NFA.
- Risk: regex parsing is a rabbit hole. Mitigation: define the supported grammar explicitly in the iteration plan; reject unsupported features with a clear error.

**Step-by-step algorithm visualization.** Show subset construction, minimization, and equivalence as they happen. Worklist, current subset, new edges added live.
- Pairs with the existing Convert / Minimize / Equivalent operations.
- Probably do NFA→DFA first; minimization + equivalence in a follow-up.
- Snapshot the step trace for known fixtures; assert structural equality.

### Tier 2 — Big features (3–5 iterations each)

**Tape view + simulation timeline.** Currently the simulation shows the *automaton* but not the *input string in motion*. Tape view: input string laid out as cells with a cursor on the current symbol. Pairs with a horizontal scrubber for jumping anywhere in history.

**Shareable URL.** Compress the current automaton into the URL hash so a paste = a working FA. Requires gzip + base64. Length budget: keep typical automaton URLs under 2000 chars (works in every browser address bar, every messaging app). Warn if encoded length exceeds that.

**Algorithm trace UI generalization.** A reusable "step trace" data structure + playback controls. Useful for any future iterative algorithm (state-elimination, Brzozowski derivatives, etc.).

### Tier 3 — Polish-as-we-go

These ride along during whichever iteration touches the relevant area; rarely warrant their own iteration.

- **Reduced-motion media query.** Suspend the breathing keyframes; shorten transitions to ~100ms. Partially shipped via the settings menu; the prefers-reduced-motion media query is still pending.
- **⌘K command palette.** Once there are 8+ commands across all widgets. Fuzzy-searchable palette over file ops, edit ops, operations.
- **Right-click context menus.** On states: "Set as start", "Toggle accept", "Delete". On edges: "Edit", "Delete". On empty canvas: "New state here". Power-user pattern; doesn't replace existing surfaces.
- **Auto-save snapshots.** Save to localStorage on every meaningful edit. On load, offer "Restore from N minutes ago".
- **Test-utils extraction.** RTL fixtures (mock automaton, render helper) duplicated across many component test files. Extract a shared `test-utils/automatonFixtures.ts`.
- **Sample library.** A "Samples" submenu inside the file widget's `⋯` popover with built-in fixtures (DFA, NFA, ε-NFA, the Sipser examples).
- **Keyboard-only editing.** Add states / set start / mark accept / add transition — all from keys. Power-user mode.
- **δ-table view.** Toggle between graph view and table view. For students who think in tables.
- **Lecture mode.** Full-screen, large fonts, no chrome. Probably one day of work.
- **State mount/unmount animation.** Visual cue for structural changes.
- **Notification highlights at zoomed scale.** Re-test after pan-zoom changes; if popovers/highlights drift, the `worldToScreen` helper is the fix.

### Tier 4 — Bigger ideas (less certain)

- **MP4 / animated export of a simulation run.** Drive the existing useSimulation step-by-step, snapshot canvas SVG to a `<canvas>` per frame, encode with WebCodecs `VideoEncoder` (MP4 H.264) or MediaRecorder (WebM). Out of scope for the current image-export path.
- **Pseudo-`?` state for incomplete DFAs.** In the Simulate view only, render a phantom state labeled `?` and route undefined transitions to it. Pure visualization — no simulation interactivity. Different visual (dashed) so it reads as "hint, not a real state."
- **DSL terminal panel.** A fourth tool-menu tab exposing a small command DSL: `add state q3`, `accept q2`, `add transition q0 0 q1`. Bidirectional — clicks could echo commands. Audience: technical users, automated agents.
- **LaTeX `tikz` export.** For course-notes use. Niche format.
- **Pumping-lemma demonstrator.** Pick a string `s = xyz`, "pump" `y`, watch the simulation. Visual proof of non-regularity.
- **"Solve this language" practice mode.** Tool generates a description; user builds an automaton; tool tests acceptance. Big design lift, big educational value.
- **Pushdown automata / Turing machines.** Explicitly out of scope per `docs/brainstorms/CUSTOMER_BRAINSTORM.md`. Different machine class.

---

## 3. Open / deferred items

Captured during prior iterations but not yet implemented. Triage and pick up when relevant.

### From the iter-5 audit

- State renaming (custom labels)
- Empty-string simulation
- "Warn before delete if there are dependents" preference toggle (could land via the settings menu)

### From the iter-7 follow-ups

- State rename in the actions popover
- Hover preview of the to-be-deleted edge before clicking Delete

### From the iter-8 audit (NFA)

- Per-branch NFA simulation UI: tabs or trees showing each branch independently. Right now all active states render in the same blue layer.
- More NFA/ε visual tweaks: a subtler dashed style on ε-edge labels (no dashed line on the edge itself per Wes's call in iter-8).
- Reserved-`e` rule on JSON load (auto-handle when import lands).

### From the iter-10 motion pass

- `@media (prefers-reduced-motion: reduce)` — suspend breathing keyframes (start arrow, accept rings) and drop hover transitions. The settings menu's `reduceMotion` toggle handles this manually; the media query auto-detection is still pending.
- Page-load entry animation for the canvas.
- State mount / unmount animation.

### Unreachable-state warning surfacing

The validator already detects unreachable states (`getOrphanedStates`, surfaced via `getValidationReport`). But warnings only render in the Simulate tab when the automaton isn't runnable — a runnable automaton with orphans never shows the warning. Future iteration: surface persistently (top of canvas? toast on edit?) so the user knows about unreachable states even when sim is fine. Could also be a soft visual on the canvas (faded state? dashed outline?).

### Backend rename: tab IDs to match user-facing labels

Tab labels were renamed from "Configure / Edit / Simulate" → "Define / Construct / Simulate", but runtime IDs (`ToolTabID = 'CONFIG' | 'EDIT' | 'SIMULATE'`) deliberately stayed. The mismatch makes new readers wonder if `'CONFIG'` means something different from "Define".

When ready to do the rename:
- `'CONFIG' → 'DEFINE'`, `'EDIT' → 'CONSTRUCT'`. Touches ~30+ callsites.
- localStorage migration for any persisted state keyed by the old ID.
- Test fixtures and JSDoc comments reference the old IDs in many places.
- Order: types.ts → grep → callsites → tests → comments → full test suite + manual smoke through every tab transition.

Not user-visible — pure bookkeeping.

---

## 4. Known bugs / things to watch

- **GraphViz layout edge cases:** tightly connected DFAs render fine but can have arrow/label overlap. Largely mitigated by the iter-19 phantom-edge refactor (start arrow now part of the layout) but dense fully-connected graphs are still imperfect.
- **State-actions popover doesn't close when canvas re-layouts:** the anchor rect is captured at click time. If layout changes (e.g. add state triggers re-layout), the popover stays where it was. Probably fine in practice.

---

## 5. User testing tasks

When friend-testing the app, hand them this list — covers the major workflows in 5 short tasks.

### Task 1 — Even count

Build a DFA over `{a, b}` that accepts strings with an **even number of a's** (any number of b's, including zero). Save the file somewhere you can find it.

### Task 2 — Triple-suffix tester

Build a DFA over `{0, 1}` that accepts strings ending in `010`.

You know it works on a few hand-typed inputs. You want to be sure it works on *thirty* inputs you have in mind. Verify it does.

### Task 3 — Nondeterminism

Build an **NFA** over `{a, b}` that accepts strings containing the substring `ab` somewhere. Then turn it into an equivalent DFA without rebuilding from scratch.

### Task 4 — Opposite day

Take any DFA you have. Without rebuilding it, produce a *new* automaton that accepts exactly the strings the original *rejects*. Confirm the two are actually opposites.

### Task 5 — Show your work

Pick the FA you're proudest of. Send me a picture of it suitable for pasting into a slide deck or homework PDF. You decide what "suitable" means.
