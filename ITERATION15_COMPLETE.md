# Iteration 15 — File Save/Load + Recents (Complete)

## What shipped

A working save/load workflow plus a recents list, hung off a new **File** tab in the tool menu. Eight phases:

1. **Format module** (`src/files/format.ts`). Versioned wrapper:
   ```jsonc
   { "kind": "automata-file", "formatVersion": 1, "metadata": {...}, "automaton": {...} }
   ```
   `serializeAutomaton(automaton, metadata) → string` and `parseAutomataFile(string) → Result<AutomataFile>`. Strict parser — six new `EngineError` variants (`parse-invalid-json`, `parse-wrong-kind`, `parse-bad-version`, `parse-malformed`, `file-read-failed`, `file-cancelled`) with corresponding `errorMessage` cases.

2. **File adapter** (`src/files/fileAdapter.ts`). Interface + universal blob-download implementation. Save = trigger a download via `<a download>` click. Open = synthesize a hidden `<input type="file">`, click it, read the chosen file with FileReader. Cancel detection via the focus-back fallback. **FS Access API adapter (Chrome save-in-place) is deferred to a future iteration** — the universal adapter works everywhere and the save-in-place gain is incremental.

3. **Recents store** (`src/files/recentsStore.ts`). localStorage-backed. Capped at 10 entries by count and ~1MB by total size; oldest entries (by `openedAt`) evicted FIFO. Each entry carries a content snapshot so reopen works even if the file moved or the browser is offline. Storage key `automata-recents-v1` with `-v1` suffix for forward compat.

4. **Dirty tracking** in `useUndoableAutomaton`. Three new fields:
   - `replaceSnapshot(snapshot)` — replace state and clear history (used on file open).
   - `markSaved()` — record current snapshot as the "saved" reference.
   - `isDirty: boolean` — true iff current snapshot reference differs from the saved one.
   Reference equality is sufficient because the engine returns new references only on real changes (existing invariant). Edge case verified: `undo` back to a saved snapshot correctly re-clears `isDirty`.

5. **Session orchestrator** `useFileSession` (`src/hooks/useFileSession.ts`). Wires together adapter + recents + dirty tracking + notification toasts. Returns `{ currentName, save, saveAs, openFile, newFile, openRecent, forgetRecent, recents }`. Owns no engine state directly; gets the snapshot via `useUndoableAutomaton` callbacks. `beforeunload` listener attached only while `isDirty` is true.

6. **UI: File tab.** New `FILE` tab added leftmost in `toolTabs`. `FilePanel.tsx` hosts: current-file indicator (name + dirty dot), New / Open / Save / Save As buttons, recents list (open on click, X-button to forget). CSS in `tool-menu.css`.

7. **Keyboard shortcuts** `useFileShortcuts` (`src/hooks/useFileShortcuts.ts`). ⌘/Ctrl+S = save, ⌘/Ctrl+Shift+S = save as, ⌘/Ctrl+O = open, ⌘/Ctrl+N = new. Gated to EDITING app mode. Uses `useKeyboardScope` with `inTextInputs: true` so shortcuts fire even while typing in inputs (Cmd+S is universally a "save" intent regardless of focus).

8. **Tests** + **sample-dfa.json bump.** Format round-trip + strict-parser rejection (16 tests), recents store with stubbed localStorage (9 tests), file adapter save + open paths (4 tests), dirty tracking + replaceSnapshot in `useUndoableAutomaton` (5 new tests). `sample-dfa.json` updated to v1 wrapper format (no consumers — file is a reference example).

Test count: **369 → 403** (+34). All green. `tsc --noEmit` clean.

---

## Phase log

| Phase | Touched | Tests added |
|---|---|---|
| 1 — Format module | format.ts + result.ts (6 new error variants) | +16 |
| 2 — File adapter | fileAdapter.ts | +4 |
| 3 — Recents store | recentsStore.ts | +9 |
| 4 — Dirty tracking | useUndoableAutomaton.ts + test | +5 |
| 5 — Session hook | useFileSession.ts | 0 (covered via integration in P8 e2e candidate; not added) |
| 6 — UI integration | FilePanel.tsx + ToolMenu.tsx + types.ts + App.tsx + tool-menu.css | 0 |
| 7 — Keyboard shortcuts | useFileShortcuts.ts | 0 |
| 8 — Sample bump + tests + docs | sample-dfa.json | (counted above) |

---

## Design decisions

### Why hybrid adapter — but ship blob-only first

The plan called for a hybrid adapter (FS Access API for Chromium, blob fallback for everyone else). The interface (`save`, `open`) is hybrid-ready: returns a `SaveOutcome` / `OpenOutcome` with a placeholder for a future `handle` field. But shipping FS Access required wiring IndexedDB-backed handle storage (because handles aren't structured-clone-safe in localStorage), capability detection, permission re-prompt UX, and Safari/Firefox fallbacks — together about as much code as the rest of the iteration. The blob path covers 100% of users for the core "save and load" workflow; save-in-place is a Chromium-only optimization that can land in iter-17+ without disrupting any of the iter-15 code (the adapter interface is the same).

### Strict format parser, not tolerant

Loading a corrupted v2-formatted file should fail loud, not silently drop fields and produce a surprise automaton. Every required field is type-checked; the typed `EngineError` variants tell the user *exactly* why the load failed. Adding fields in v2 (e.g. layout positions, test cases) will be a v1→v2 migration in `src/files/migrations/`, not a tolerance widening here.

### Snapshot caching in recents

Recents store the full serialized JSON (capped at 250KB per entry, 1MB total). Yes, it's redundant with the file on disk — but it makes recents resilient to:
- Files that moved or were deleted.
- Offline use.
- Non-FS-Access browsers (where there's no handle to re-grab anyway).

The cost is modest (1MB of localStorage) and the UX gain is large for an educational tool where students shuttle files between machines or work in browser-only contexts.

### Dirty tracking via reference equality

`isDirty = current.snapshot !== savedSnapshotRef.current`. Cheap, correct, piggybacks on the existing immutability discipline. The same trick works for confirming a clean state after `undo` returns to a saved snapshot — no special undo-cursor logic needed. Tested explicitly.

### Why `useFileShortcuts` opts into `inTextInputs: true`

⌘S and friends are universally "do file operation" intent regardless of focus. The user typing into the alphabet input still expects ⌘S to save the project, not to insert a character. The keyboard scope library supports this opt-in; we use it.

### Why the FILE tab is leftmost

File operations are workflow-prefix actions (open a file, *then* edit it). Putting them leftmost matches the natural reading order and groups them away from the inner-loop edit/simulate flow.

### Stubbed localStorage in tests

vitest's jsdom `localStorage` proved unreliable: `removeItem` was missing in this environment despite jsdom's standalone `localStorage` having it. Rather than fight it, the recents-store tests install a Map-backed `localStorage` stub in `beforeEach`. Same observable interface; deterministic.

---

## What stayed the same

- Every engine semantic.
- Every UI behavior outside the new File tab.
- All animations from iter-12 + iter-14.
- `useUndoableAutomaton`'s public hook contract for existing fields. New methods are additive.
- The pre-existing `handleExportJSON` in `App.tsx` is now dead code (replaced by `fileSession.save`); leaving it in place this iteration to minimize merge surface, will be cleaned up in iter-16+.

---

## Out of scope / deferred

- **FS Access API adapter** — Chromium save-in-place + IndexedDB-backed handle storage. Future iteration.
- **Persistent recents handle reattachment** — paired with FS Access. Today recents always load from snapshot; with handles, they could load fresh from disk if the user grants permission.
- **Migration from v1 → v2 format** — registry skeleton not built; will land alongside the first v2 schema change.
- **Test cases bundled in file** — sample-dfa.json has a `testCases` field, but the editor doesn't surface them. Iter-17+.
- **Auto-save on edit** — manual save only.
- **Reduced-motion media query** — still deferred.
- **`InputPanel` / `AlphabetEditor` RTL backfill** — still deferred from iter-13.

---

## Browser verification recommended

Wes should verify on next session:
1. **New + dirty marker** — start a fresh app, add a state, see the • dirty marker; click New, get the confirm dialog.
2. **Save + Open** — save a file, edit, open the saved file, verify it round-trips correctly.
3. **Recents** — save a few files, see them appear in the recents list, click to reopen, X to forget.
4. **Keyboard shortcuts** — ⌘S / ⌘O / ⌘N / ⌘⇧S in EDIT mode; verify they don't fire in TEST/INFO/SIMULATE.
5. **`beforeunload`** — close the tab while dirty → browser prompts; close while clean → no prompt.

---

## How to run

```bash
cd /Users/wesorr/Documents/Projects/Project\ Automata/.claude/worktrees/iter-12
npm test -- --run            # 403 passing
npx tsc --noEmit             # clean
npm run dev                  # browser verification
```
