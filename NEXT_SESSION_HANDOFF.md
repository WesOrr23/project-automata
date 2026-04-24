# Next Session Handoff

Everything you need to pick up where iteration 7 left off, written for whoever opens the next chat.

---

## Where things stand right now

- **Branch**: `iteration-7` (committed and ready; not merged to main)
- **Tests**: 169 passing, typecheck clean
- **Last commit**: `Modify color, state-click popover, overwrite warning` (5609f44)
- **Auto mode**: ON
- **Notification system**: in place (iter 6) — `useNotifications().notify({...})` available everywhere
- **Iteration 7 plan**: see `ITERATION7_PLAN.md` (already documented as complete in `ITERATION7_COMPLETE.md`)

---

## Wes's working style (read before starting)

This is the most important section. The user is a CS student building skills as a developer. Conventions that have emerged:

### Mode preferences
- **Mentor mode** (`/mentor`) — used when actively learning. User writes the code; you explain concepts and walk through decisions without writing code yourself. Reference `~/.claude/rules/mentor-mode.md` for full rules.
- **Execution mode** — used when shipping features. Auto-mode active. You write code, commit per phase, run tests, screenshot to verify.
- The default is execution. **Switch to mentor only if explicitly invoked.** Iter 5 had a "let's do mentor mode" stretch that the user ultimately abandoned because they were stressed; they want to do reviews AFTER the code ships, not during.

### Iteration discipline
- Every iteration starts with `ITERATION{N}_PLAN.md` *before* writing any code.
- Iteration ends with `ITERATION{N}_COMPLETE.md` summarizing what shipped.
- Phases within an iteration get their own commits (Phase 1 / Phase 2 / etc).
- Tests + typecheck + visual verify before each commit.
- One thing at a time. The user gets actively frustrated when changes cascade unexpectedly. Don't refactor scope you weren't asked to refactor.

### What the user values
- **The #1 rule**: the tool menu (Configure / Edit / Simulate cards) must always fit the viewport. The active card scrolls internally; compact cards stay visible. Don't break this.
- **Discoverable UX over clever shortcuts.** Buttons disabled with explanatory instruction text > buttons that change label.
- **Direct manipulation of visuals.** Canvas-first editing, not table-based.
- **Honest feedback.** When the user pushes back on something, take it seriously. They're often right; when they're not, explain *why* with concrete reasoning rather than appeasing.
- **Architectural patterns documented as we go.** `ARCHITECTURAL_PATTERNS.md` grows with each iteration.

### What the user dislikes
- Yellow as a UI color (just shipped — Modify is now violet)
- Layouts that grow infinitely without bounds
- Modal popups that overlap content they're meant to interact with
- Excessive cleverness when a simple approach would do
- Sycophancy / flattery in your responses

---

## Iteration 8: Undo / Redo (next priority)

The user explicitly asked for this. Plan elements (start with these in `ITERATION8_PLAN.md`):

### What needs to be reversible
- Add / remove state
- Set start state, toggle accept state
- Add / remove / replace transition (use the existing `handleSetTransition` / `handleReplaceTransition` as the primitive operations)
- Alphabet add / remove
- Type change (DFA / NFA)
- Probably NOT: simulation control (that has its own history via the simulation reducer)

### Architecture options to consider
- **Snapshot stack**: every edit pushes the prior `Automaton` onto a history stack. Undo pops, applies. Simple, memory hog at scale (each Automaton is big-ish).
- **Inverse-action stack**: every edit records its inverse (e.g. "addState 3" → "removeState 3"). Smaller per entry, more complex to define inverses for cascade ops (e.g. removeState removes transitions too).
- **Immer-like diff**: structural sharing means snapshots are cheap. May not be worth a new dependency.

Recommendation: **snapshot stack** for simplicity. The Automaton is a small object even with many states. Cap at ~50 entries.

### UI placement
- Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z keyboard shortcuts.
- Visual buttons: probably small Undo / Redo icons in a corner — could go in the Configure tab, or as a floating control near the canvas.

### Edge cases
- Reset history when the automaton is wholesale replaced (e.g. JSON import — when that lands).
- Don't push history for no-op edits (e.g. setStartState to current start).

---

## Other items captured but not yet implemented

These are documented in iteration plans / audits but are still open:

### From iter 5 audit (deferred, still open)
- State renaming (custom labels)
- Auto-increment transition form (the table-era idea — N/A now)
- Empty-string simulation
- "Warn before delete if there are dependents" preference toggle

### From iter 6 audit (deferred, still open)
- Self-loop visualization in the mini SVG
- Notification system polish (already shipped, no major issues known)

### From iter 7
- State rename in the actions popover
- Maybe: hover preview of the to-be-deleted edge before clicking Delete

### From CLAUDE.md backlog
- Iteration 9: Animations & Polish
- Iteration 10: NFA → DFA conversion, minimization, equivalence
- Iteration 11: Edge routing & overlap prevention

---

## Bugs / issues to watch for

- **GraphViz layout edge cases**: tightly connected DFAs render fine but can have arrow/label overlap. Documented in CLAUDE.md memory file.
- **The start-state arrow viewBox fix is hardcoded to 70px**. If the arrow length changes, this should too.
- **State-actions popover doesn't close when canvas re-layouts**: the anchor rect is captured at click time. If layout changes (e.g. add state triggers re-layout), the popover stays where it was. Probably fine in practice.

---

## File / folder map

```
src/
├── App.tsx                                ← orchestrator, owns most state
├── main.tsx                               ← React root, wraps in providers
├── engine/                                ← pure TypeScript, no React
│   ├── automaton.ts                       ← CRUD primitives
│   ├── simulator.ts                       ← step-by-step DFA execution
│   ├── validator.ts                       ← isRunnable, getValidationReport, etc
│   └── types.ts                           ← Automaton, Transition
├── hooks/
│   └── useSimulation.ts                   ← reducer-based simulation hook
├── ui-state/
│   ├── types.ts                           ← StateUI, AutomatonUI, computeDisplayLabels
│   └── utils.ts                           ← computeLayout (GraphViz async)
├── components/
│   ├── AutomatonCanvas.tsx                ← the SVG canvas
│   ├── StateNode.tsx                      ← one circle
│   ├── TransitionEdge.tsx                 ← one curved arrow
│   ├── StartStateArrow.tsx                ← marker arrow on start state
│   ├── InputPanel.tsx                     ← simulation input field
│   ├── SimulationControls.tsx             ← play/step/back/etc
│   ├── popover/
│   │   ├── StatePickerPopover.tsx         ← list of states, pick one
│   │   └── StateActionsPopover.tsx        ← state actions menu (set start / etc)
│   ├── transitionEditor/
│   │   ├── creationReducer.ts (+ tests)   ← the form's state machine
│   │   ├── TransitionCreator.tsx          ← composer
│   │   └── MiniTransitionSVG.tsx          ← preview
│   └── toolMenu/
│       ├── ToolMenu.tsx                   ← 3-state nav (collapsed/expanded/open)
│       ├── ConfigPanel.tsx                ← type toggle + JSON export
│       ├── EditPanel.tsx                  ← composes Alphabet + State + Transition editors
│       ├── AlphabetEditor.tsx
│       ├── StateEditor.tsx
│       └── types.ts                       ← ToolTabID, ToolMenuState
└── notifications/
    ├── NotificationContext.tsx            ← provider
    ├── useNotifications.ts                ← hook
    ├── NotificationStack.tsx              ← top-right toasts
    ├── NotificationToast.tsx              ← one toast
    └── types.ts                           ← Notification, NotificationTarget
```

Reference docs in repo root:
- `CLAUDE.md` — project memory, architecture summary, open questions
- `ARCHITECTURAL_PATTERNS.md` — every cross-cutting design pattern with rule/why/where/mistakes
- `ITERATION{N}_PLAN.md` / `_COMPLETE.md` / `_AUDIT.md` per iteration
- `NEXT_SESSION_HANDOFF.md` — this file

---

## How to verify in the browser

A vite-dev server is already configured in `.claude/launch.json`:

```bash
# usually just:
npm run dev
# or use the Claude Preview MCP server
```

Quick checks to run before saying "this works":
1. `npm test -- --run` — all 169 tests passing
2. `npx tsc --noEmit` — clean
3. Screenshot via the preview server — verify the visual matches intent
4. For interactive features: build a small DFA in Edit tab, simulate a string, check the canvas highlights work

---

## A note on the conversation history

The chat history that produced iter 6 + iter 7 is long and circuitous. If you read back through it, the key emotional beats:

- Iter 6's transition table was a multi-day struggle that produced little value. We rewrote it 3 times in different forms (table → custom dropdown → CSS Grid → start over). The user got understandably frustrated. The lesson: when a UI approach keeps requiring fixes that introduce new fixes, the constraint mismatch is the problem, not the implementation. Pivot the approach, don't keep patching.

- The visual transition editor (iter 7) was the user's idea, sketched in plain prose. It worked beautifully on the first plan draft. The lesson: trust the user's UX intuitions for their own product.

- The user wants to do post-iteration code reviews where you walk them through each file. Currently deferred. They flagged it explicitly: they want to do this *after* the build is done, when the stress of shipping is off. Be ready to do this in future sessions if asked.

- Mentor mode hooks: the user activates this with `/mentor`. It's documented in `~/.claude/rules/mentor-mode.md` (their global rules). When in mentor mode, you do not write code — you guide and explain.
