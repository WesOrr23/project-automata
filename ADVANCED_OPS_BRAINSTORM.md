# Advanced Settings / Operations — Where Do They Live?

> Triggered by: "Convert to DFA is not something that will be used a lot, so it shouldn't be with all the other stuff."

The CommandBar holds COMMON command-tier UI (file + history). Operation-tier transformations like Convert to DFA, Minimize, Equivalence-check, Complement, Regex→NFA — these are **niche and EDIT-mode-specific**. They need their own home.

## Mental tiers

Three tiers I'd separate, by frequency of use:

| Tier | Examples | When used | Surface |
|---|---|---|---|
| **Always-on** | New / Open / Save, Zoom | Every session, many times | CommandBar (file) + CanvasZoomControls |
| **Mode-tier** | Undo / Redo | Many times *while editing* | CommandBar EDIT segment |
| **Operation-tier** | Convert / Minimize / Equivalence / Complement / Regex→NFA / Regex→DFA / Export image | Rarely (a few times per FA, sometimes never) | **This is what we're solving** |

## Five placement options

### A. Inline buttons in the EDIT panel (what I just shipped)
Each operation gets a button in the Operations footer of the EditPanel.

**Pros**: zero new chrome. Discovery is implicit (you scroll through Edit and see them).
**Cons**: as ops accumulate (Minimize, Equivalence, Complement, Regex→NFA…), the footer becomes a wall of buttons in a narrow panel. Loses categorization. Doesn't fit "advanced" framing — it's right next to the alphabet editor.

**Verdict**: works for 1–2 ops. Doesn't scale to 5+.

### B. New "Advanced" tab in the tool menu
A 4th tab (after CONFIG / EDIT / SIMULATE) with a panel listing operations.

**Pros**: fits the existing tab pattern. Clean separation. Discoverable label ("Advanced").
**Cons**: re-introduces the 4-tab problem (which forced the menu height bump that triggered the laggy animation in the first place). Adds permanent chrome for rarely-used features.

**Verdict**: theoretically clean, but we just *removed* a 4th tab for good reasons.

### C. Floating "Operations" widget (pill or icon button) at top-right
A small floating widget — maybe a single icon button (sparkle / wand / ⚡) — that opens a popover menu of operations. Visible only in EDIT mode.

**Pros**: discoverable but quiet. Low chrome at rest. Categorization possible inside the popover (Conversions / Analysis / Export). Hidden in CONFIG/SIMULATE so it never adds noise.
**Cons**: a fourth piece of floating chrome (CommandBar, tool menu, zoom, this). Top-right is currently used by NotificationStack — would conflict.

**Verdict**: good if we can find a slot. Maybe top-center alongside CommandBar?

### D. Right-click menu on the canvas
Right-click on empty canvas opens a context menu with Operations.

**Pros**: zero permanent chrome. Discoverable via the "context menu" mental model students already have.
**Cons**: completely invisible until discovered. Mobile/touch can't right-click. Power-user pattern, not intuitive for beginners.

**Verdict**: nice as an *additional* path, not the primary one.

### E. Slash-command palette (`⌘K`)
Press a key, get a searchable command list à la VS Code / Linear / Notion.

**Pros**: industry-standard pattern. Scales to 50+ commands without UI weight. Power users love it.
**Cons**: requires the user to know to press a key. Discoverability is poor for beginners.

**Verdict**: great as an *additional* path (parallel to whatever else); not primary.

## My recommendation

**C + E together.**

- **C (Operations widget)** as the primary discoverable home. Pinned to TOP-CENTER, sitting just below the CommandBar (or to its right) when in EDIT mode. Single icon button (something like a `Wand2` or `Sparkles` from Lucide). Click → popover with categorized list:

  ```
  ╭────────────────────────╮
  │ Conversions            │
  │   Convert NFA to DFA   │
  │   Regex → NFA          │
  │ Analysis               │
  │   Minimize DFA         │
  │   Check equivalence... │
  │ Export                 │
  │   Save as image (PNG)  │
  │   Save as image (SVG)  │
  ╰────────────────────────╯
  ```

  Each item is enabled/disabled based on context (Convert NFA→DFA grayed when type is DFA; Minimize grayed when DFA is already minimal; etc.). Empty categories collapse.

- **E (⌘K palette)** as the parallel keyboard path. Pressing `⌘K` (or `/`) opens a fuzzy-searchable command list with the same items + the file/edit commands. Skip for iter-17; build when there are 8+ commands.

- **Strip the inline Operations footer from EditPanel** once the widget is in. Don't double-surface.

- **Keep right-click as a future thought.** Worth doing eventually for canvas-context-aware ops ("Make this state the start state" etc.) but separate concern.

## Concrete first step

For the next iteration:

1. Move "Convert to DFA" out of EditPanel into a new `OperationsWidget` floating top-center, right of the CommandBar's right edge, EDIT-only.
2. Position it as a small icon button (icon: `Wand2` or `Sparkles`) that opens a popover menu.
3. Add a single category "Conversions" with one item ("Convert NFA to DFA").
4. Wire the existing `handleConvertToDfa` to the menu item.
5. Defer Minimize/Complement/Equivalence/Regex implementations — when those land, they slot into this widget without further UI work.

Cost: ~150 lines + tests. Benefit: clean home for everything operation-tier we'll add next.

## Why not "Advanced settings" in CONFIG

Briefly considered: maybe operations could live as a "tools" subsection inside the Configure tab. But Configure is *settings* — alphabet, type, ε-symbol. Operations *transform* the automaton, which is closer in nature to undo/redo than to "set a config value." Wrong mental category.
