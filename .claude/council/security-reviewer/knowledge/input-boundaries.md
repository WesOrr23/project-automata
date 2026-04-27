---
agent: security-reviewer
type: knowledge
topic: input-boundaries
schema-version: 1
verified-as-of: dd6420b
last-updated: 2026-04-27
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

### Iter-15+ input boundaries

5. **File-load JSON content** (`src/files/fileAdapter.ts` → `src/files/format.ts parseAutomataFile`) — untrusted JSON from disk via `<input type="file">` + `FileReader.readAsText`. Strict parse-then-validate (`kind` discriminator, explicit per-field reads, no merge/spread). **No size cap currently** — a 100 MB JSON would crash the tab via `JSON.parse`, low realistic risk for an educational static app. If iter-N+ adds drag-drop or share-link import, add `MAX_FILE_BYTES` at the parser entry.
6. **Recents snapshot reopen** (`src/files/recentsStore.ts` → `useFileSession.openRecent`) — snapshot stored in localStorage is re-validated through `parseAutomataFile` on reopen, **not trusted blindly**. Defense-in-depth: even hand-edited localStorage content can't bypass the validator.
7. **Description textarea** (`src/components/toolMenu/ConfigPanel.tsx` `description` state) — free-form text, no length cap. Persists to file metadata and to localStorage recents snapshot. Rendered only as `<textarea value={...}>` (controlled-input prop, React-escaped) and as JSX text children. **Privacy**: see attack-surface.md note on shared-machine recents persistence.
8. **CSV import for batch testing** (`src/components/BatchTestModal.tsx handleFileChange`) — `FileReader.readAsText` + naive split on `\r?\n` and comma. Flows into the simulator as input strings, which are filtered against the alphabet before reaching the engine. Safe — never rendered as anything but a textarea value.

### Indirect input boundaries

- **GraphViz output** (`src/ui-state/utils.ts` / `src/ui-state/graphvizParse.ts` parsers) — output of an internal tool, not user input. Trust as far as the tool's known behavior allows.

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
