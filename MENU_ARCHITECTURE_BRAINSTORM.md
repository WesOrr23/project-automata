# Tool Menu Architecture — Brainstorm

> Triggered by: "I really want the left tool menu to feel like a step-by-step process. But that also means that not everything will be contained in this menu… just like how we expose Undo/Redo only in edit mode, I will want to do some of that for the other modes too. Maybe file management doesn't need to be its own menuTab, but can be another on-screen widget only available in config mode? Or maybe that breaks UX feel?"

This is a re-architecture brainstorm, not a plan yet. End of doc has a recommendation, but you should weigh in before anyone commits.

## The mental model shift

Current state: the tool menu is a **flat collection of tabs** — every tool tier lives there. Adding the FILE tab made this unbalanced (file ops aren't a workflow step; they're meta).

Proposed state: the tool menu is a **workflow ladder**. Each tab represents a *phase of building an automaton*: Configure → Edit → Simulate. Things that aren't phases live as **modal widgets** floating around the canvas, surfaced by the current mode.

Modal widgets pattern is already established:
- **UndoRedoControls** — visible only in EDIT mode (top-center).
- **CanvasZoomControls** — always visible, but conceptually the canvas's own affordance.
- **NotificationStack** — global.
- **canvas-tip** — visible only in EDIT idle.

So we're not inventing a new UI primitive — we're saying "lean into it."

## What belongs in tabs vs widgets

A useful test: **"is this a step in the workflow, or a tool I reach for at any time within a step?"**

| Item | Workflow step? | Reach-for tool? | Verdict |
|---|---|---|---|
| Configure (alphabet, type, ε-symbol) | yes — defines what the FA can express | | Tab |
| Edit (states, transitions) | yes — the bulk of the work | | Tab |
| Simulate (input string, step) | yes — testing the FA | | Tab |
| File ops (save, open, recents) | no — orthogonal to the workflow | yes | Widget |
| Undo/redo | no | yes — only meaningful while editing | Widget (already) |
| Convert to DFA / Minimize / Operations | no | yes — only meaningful while editing | Widget |
| Zoom | no | yes — always | Widget (already) |
| Validation messages | no | yes — only meaningful when there's a problem | Widget? (currently inline in Simulate tab) |

If we apply this strictly, the tool menu drops back to **3 tabs** (CONFIG / EDIT / SIMULATE), and the menu math returns to fitting 3 rows ≤ 120px. Feels right.

## Where the widgets go

Available real estate around the canvas:

```
┌─────────────────────────────────────────────────────────────────┐
│ TOP-LEFT          TOP-CENTER          TOP-RIGHT                 │
│                                                                 │
│                                                                 │
│ TOOL                                                            │
│ MENU                  CANVAS                                    │
│                                                                 │
│                                                                 │
│ BOTTOM-LEFT       BOTTOM-CENTER       BOTTOM-RIGHT              │
└─────────────────────────────────────────────────────────────────┘
```

Currently:
- TOP-CENTER: undo/redo (EDIT only)
- BOTTOM-RIGHT: zoom controls (always) + canvas-tip (EDIT idle)
- LEFT: tool menu (always)
- TOP-RIGHT: notification stack (always)

Free zones: TOP-LEFT, BOTTOM-LEFT, BOTTOM-CENTER.

Three rough placement schemes for new widgets:

### Scheme A — top-left strip, mode-agnostic
```
  ┌─────────────────────┐
  │ ⌘ Untitled •  📁 📂 💾 │   <-- file widget (always visible)
  └─────────────────────┘
  ┌────┐
  │tool│   ┌──────────┐
  │menu│   │  ↶  ↷    │ undo/redo (EDIT only)
  └────┘   └──────────┘
            ┌──────────────┐
            │ Convert  ⋮ │ operations (EDIT only)
            └──────────────┘
```

File widget is always visible at top-left. Operations widget joins the existing top-center strip in EDIT mode.

**Pros**: file ops always accessible (don't need to click to a CONFIG tab to save). Visual layering is consistent. Top-left is currently empty.
**Cons**: top edge becomes crowded across modes if more widgets appear.

### Scheme B — mode-aware "header" strip across the top
A thin horizontal strip that morphs based on mode:
- CONFIG: file ops + alphabet summary?
- EDIT: file ops + undo/redo + operations
- SIMULATE: file ops + simulation playback?

**Pros**: one consistent location for "command bar" things. Familiar pattern (every IDE/editor has this).
**Cons**: feels like a traditional app menu bar — not a fit with the floating-widget aesthetic the rest of the UI has. More chrome on screen.

### Scheme C — mode-aware "satellite" widgets
Each mode gets its own dedicated widget cluster, positioned with intent:
- **File widget** stays always-visible (top-left or top-center). Reasoning: file ops are orthogonal to mode; the user can save while reviewing simulation.
- **Edit widgets** (undo/redo, operations like Convert/Minimize) cluster top-center, visible only in EDIT.
- **Simulation widgets** (replay scrubber? reset? jump-to-step?) cluster bottom-center or top-center, visible only in SIMULATE.
- **Configure widgets** — probably none beyond the panel (CONFIG is settings-heavy and doesn't have inline-actionable items).

**Pros**: matches the user's stated mental model directly. Each mode "lights up" its own tools. No crowded top edge.
**Cons**: more design work per-mode. Risk of inconsistent visual language if not careful.

### Scheme D — pull-out drawer per mode (more radical)
Tool menu becomes thinner, plus a secondary "actions drawer" that slides in from the side opposite the menu, populated based on mode. Like a wing of action items.

**Pros**: very strong "mode = workspace" feel. Lots of room for future tools.
**Cons**: a lot of new chrome. Doubles the menu weight visually. Probably overkill for the current tool count.

## Where file ops actually belong

Wes asked: "Maybe file management doesn't need to be its own menuTab, but can be another on-screen widget only available in config mode? Or maybe that breaks UX feel?"

My read: **gating file ops to CONFIG mode breaks UX feel.** Two reasons:
1. Saving is something you want to do *at the moment you finish a chunk of work*, which is most often after editing (not after configuring). Forcing a tab switch to save would feel wrong.
2. The user's existing model treats CONFIG as "settings." Putting Open/Save there misclassifies them.

Better: **file ops are always-available** as a global widget. Like a small File menu in the corner, or the inline filename + save indicator.

## What's outside this discussion

A few items that are real but not part of this brainstorm:
- **Where Convert to DFA lives** — partly subsumed (it goes in an EDIT-only widget rather than a tab), but the specific design needs its own pass.
- **Whether SIMULATE deserves an inline widget** — currently the input panel + simulation controls live inside the SIMULATE tab. Could move to widgets if simulation feels too cramped, but no one's complained yet.
- **Whether the CanvasZoomControls deserve their always-on slot** — they could become a hover-on-canvas affordance instead. Out of scope.

## Recommendation

**Scheme C (mode-aware satellites), with file ops always visible.** Specifically:

1. **Drop FILE from the tool menu.** Back to 3 tabs (CONFIG / EDIT / SIMULATE). Menu max-height returns to ~120px.
2. **File widget**: small floating chip at the top-left of the canvas. Shows the current filename + a • dirty marker, with three icon-buttons: New / Open / Save. A small ⋯ menu inside it for Save As + Recents. Always visible across modes.
3. **Operations widget**: floats top-center alongside the existing UndoRedoControls. Shows in EDIT mode only. Currently one button (Convert to DFA); when iter-17 lands minimization/complement/equivalence, those join.
4. **Simulation widgets**: deferred until we feel the SIMULATE tab is too cramped. None for now.
5. **Tab order in the menu**: CONFIG → EDIT → SIMULATE (matches workflow direction).

Why this over Scheme A:
- Scheme A keeps the file widget always visible too, but doesn't really make the tool-menu-as-workflow-ladder argument as cleanly. Scheme C is the same outcome with a clearer reason.

What this costs:
- Removing FILE tab requires deleting `FilePanel.tsx` (or repurposing it as the widget body).
- A new `FileWidget.tsx` component.
- A new `OperationsWidget.tsx` component (initially just wraps the Convert button).
- `App.tsx` wiring (mostly moves; file session and convert handler already exist).
- Tests already on `FilePanel.tsx` would need migration to `FileWidget.tsx`.

What this risks:
- Top-left has been empty; introducing chrome there competes with the canvas. Mitigation: keep the widget compact, low-contrast.
- Filename + dirty indicator at top-left vs at the top of a CONFIG/EDIT panel — small inconsistency for users who learn one location.
- If iter-17+ needs to add many more inline operations, the operations widget might bloat. Easy mitigation when it happens: convert to a small dropdown menu.

## Open questions for Wes

1. **Is "always visible" the right call for file ops, or should they be visible-when-EDIT-or-CONFIG (hidden during SIMULATE)?** I lean always; you can save anything, anytime.
2. **File widget at top-left vs top-center vs grouped with undo/redo?** Top-left feels right (gives undo/redo its breathing room) but it's a UX taste call.
3. **Operations widget design** — do you want a single button per op (top-center grows wide as ops accumulate), or a single "Operations" pill that expands a menu on click?
4. **Should we strip the "Operations" footer out of the EDIT panel now,** or leave it as a fallback until the widget is built?
5. **Do we want a unified visual for all widgets** (matching pill shape, shadow, hover treatment) — or do they each get to look slightly different by purpose?
