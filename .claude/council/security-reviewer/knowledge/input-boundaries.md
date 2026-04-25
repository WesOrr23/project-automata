---
agent: security-reviewer
type: knowledge
topic: input-boundaries
schema-version: 1
verified-as-of: 52bdb8e
last-updated: 2026-04-25
confidence: high
---

# Input Boundaries

## Principle

Every place user input enters the system is a boundary. Track them all. Each new boundary is a place that needs review when added or changed.

## Current state

### Concrete input boundaries today

1. **`InputPanel`** (`src/components/InputPanel.tsx`) — the test-string input field. Length-bounded by reasonable limits. Filtered client-side to the alphabet for display purposes. Contents passed to the simulator.
2. **`AlphabetEditor`** (`src/components/toolMenu/AlphabetEditor.tsx`) — single-character input for adding alphabet symbols. `maxLength={1}` enforced at the input level. A paste-truncation warning fires synchronously on multi-char pastes; the browser's `maxLength` keeps only the first character.
3. **`StateEditor`** / state label editing — accepts a display label string. Written into `UIState.labels`. Rendered as SVG text content (escaped by React).
4. **Transition symbol entry** (`TransitionCreator`) — accepts a comma-separated symbol list. Parsed into individual symbols; each must be in the alphabet.

### Indirect input boundaries

- **Sample automaton loading** (`src/data/sample-dfa.json`) — currently a static asset, not user-loaded. *If* a future iteration adds user-supplied JSON loading, that becomes a fresh input boundary.
- **GraphViz output** (`src/ui-state/utils.ts` parsers) — output of an internal tool, not user input. Trust as far as the tool's known behavior allows.

## What to look for in diffs

- New input controls (`<input>`, `<textarea>`, `<select>` with user-typed options, contenteditable elements).
- Drag and drop handlers (`onDrop`, `onDragOver` accepting files or text payloads).
- Paste handlers that accept multi-line or formatted content.
- New file-upload UI.
- URL/query-string parameter parsing.
- Any place `JSON.parse` is called on a string the user could influence.
- Places where user-controlled strings are interpolated into:
  - SVG attribute values (`d=`, `title=`, `transform=`, `style=`)
  - CSS `var()` references with user-derived values
  - HTML attribute values via JSX prop spreading

## What's fine

- Adding length-bounded text inputs with character validation.
- Rendering user strings as React text children (safe by default).
- Using user strings in `aria-label`, `title` (HTML attribute, not SVG `<title>`), `placeholder` — React escapes these.

## Provenance

Verified by reading `InputPanel.tsx`, `AlphabetEditor.tsx`, `StateEditor.tsx`, `TransitionCreator.tsx` at commit `52bdb8e`.
