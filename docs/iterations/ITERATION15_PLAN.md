# Iteration 15 — File Save/Load + Recents (Plan)

## Context

The current build is browser-only with no persistence. Refresh = lose everything. Wes asked for "file save / load and recents" — real files, not just localStorage. Architecture review (Plan agent, this iteration) confirms the approach: hybrid adapter (File System Access API where available, blob download fallback) plus a small recents store backed by localStorage + IndexedDB.

The existing `handleExportJSON` in `App.tsx` already proves the download path works. `sample-dfa.json` already has a viable wrapper shape (`{ name, description, automaton, testCases }`). This iteration canonicalizes and versions that shape, builds the symmetric load path, and adds recents.

## Goals

1. **Real file save/load.** Save the current automaton to a file the user picks; open a file from disk and load it. On Chrome/Edge, "Save" persists to the same file (FS Access handle). On Safari/Firefox, "Save" is a download.
2. **Recents list.** Up to 10 recent automatons, each with metadata + a content snapshot so the user can re-open even if the file moved or they're offline.
3. **Format versioning.** `{ kind: "automata-file", formatVersion: 1, metadata, automaton }`. Strict schema validation; reject unknown shapes loudly.
4. **Unsaved-changes guard.** Track dirty state; warn before destructive nav (New, Open, recents-click, browser close).
5. **Keyboard shortcuts.** ⌘S (save), ⌘⇧S (save as), ⌘O (open), ⌘N (new). Gated to EDIT mode.
6. **All tests green.** Test count grows: format parsing, adapter, recents store, dirty tracking, session hook.

## Non-goals

- Cloud sync, accounts, auth.
- Multi-file editing (one automaton at a time still).
- Migration path beyond v1 → v2 scaffolding (no v2 yet).
- Format conversion (CSV / DOT / etc.) — JSON only.

## Architectural decisions

### File format

```jsonc
{
  "kind": "automata-file",
  "formatVersion": 1,
  "metadata": {
    "name": "Strings ending in 01",
    "description": "Sipser Example 1.7",
    "createdAt": "2026-04-26T18:30:00Z",
    "modifiedAt": "2026-04-26T18:42:13Z"
  },
  "automaton": {
    "type": "DFA",
    "states": [0, 1, 2],
    "alphabet": ["0", "1"],
    "transitions": [{ "from": 0, "to": [1], "symbol": "0" }],
    "startState": 0,
    "acceptStates": [2],
    "nextStateId": 3
  }
}
```

- `kind` discriminator so other JSON files don't get misinterpreted as automatons.
- `formatVersion` integer for migration routing.
- `metadata` separate from `automaton` so the engine type stays pure.
- Sets serialize as arrays (already the convention).

### Storage adapter — hybrid

`src/files/fileAdapter.ts`:

```ts
interface FileAdapter {
  save(content: string, suggestedName: string, handle?: FileSystemFileHandle):
    Promise<Result<{ name: string; handle: FileSystemFileHandle | null }>>;
  open():
    Promise<Result<{ name: string; content: string; handle: FileSystemFileHandle | null }>>;
}
```

Two implementations, picked once at module load via capability detection:

- **`fsAccessAdapter`** — Chrome/Edge. Real save-in-place. Returns a `FileSystemFileHandle`.
- **`blobDownloadAdapter`** — Universal fallback. Save → triggers download. Open → file input picker. No handle returned.

UI doesn't branch; calls one adapter interface.

### Recents store

`src/files/recentsStore.ts`:

- **Index** in localStorage: `RecentEntry[]` with `{ id, name, savedAt, openedAt, sizeBytes }`. Capped at 10 entries.
- **Content snapshots** in IndexedDB: keyed by `id`, stores `{ snapshot: string, handle?: FileSystemFileHandle }`. IDB because handles aren't structured-clone-safe in localStorage but ARE in IDB. Capped at ~1MB total.
- **Reopen flow:** if entry has a handle, try `handle.queryPermission()` → granted: read live file. Denied or no handle: fall back to cached snapshot with a "from cache" badge.

### Dirty tracking

In `useUndoableAutomaton`:

- Add `savedSnapshotRef: React.RefObject<Snapshot | null>`. Set to current snapshot reference on `markSaved()`.
- Add derived `isDirty: boolean` — `true` iff current snapshot reference !== savedSnapshotRef.
- Reference equality is sufficient because the engine already returns new references only on real changes (existing invariant).
- Edge case: undo back to a saved state should clear dirty. Handled by reference comparison naturally — undo returns the prior reference.

### Session hook

`src/hooks/useFileSession.ts`:

```ts
const { newFile, openFile, save, saveAs, recents, currentName, isDirty }
  = useFileSession({ adapter, recentsStore, undoableAutomaton, notify });
```

Orchestrates: adapter calls + recents updates + dirty-state coordination + notification toasts. App.tsx wiring stays thin.

### UI placement — new "File" tab, leftmost

Adding `FILE` as the first tab fits the existing tool-menu pattern. The File panel hosts:
- **New** (with confirm if dirty)
- **Open** (with confirm if dirty)
- **Save** (⌘S)
- **Save As** (⌘⇧S)
- **Recents** list (each entry: name, opened-at, "from cache" badge if applicable, click to open)

Move `handleExportJSON` out of Configure into the File panel as "Save."

### Confirm dialog

Reuse popover styling. Two-button dialog: "Discard" / "Cancel." Optional third "Save then continue" button if applicable.

### `beforeunload` listener

Attached only while `isDirty` is true. Detached otherwise so users on a clean session never see a confirm.

## Phase order

### Phase 1 — Format module
1. Create `src/files/format.ts`: types + `serializeAutomaton`, `parseAutomataFile`. Strict schema validation. Returns `Result<AutomataFile>`.
2. Move Set→array conversion out of `App.tsx`'s `handleExportJSON` into the format module.
3. Migration registry skeleton (`src/files/migrations/index.ts`) — empty.
4. Tests: round-trip property, malformed input rejection, missing-field rejection.
5. Update `src/data/sample-dfa.json` to include `kind` and `formatVersion`. Update any tests that read it.

### Phase 2 — File adapter
6. Create `src/files/fileAdapter.ts`: interface + factory with capability detection.
7. Implement `blobDownloadAdapter.ts` (universal). Tests in jsdom (mock `URL.createObjectURL`).
8. Implement `fsAccessAdapter.ts` (Chrome). Tests with injected mock of `showSaveFilePicker` / `showOpenFilePicker`.

### Phase 3 — Recents store
9. Create `src/files/recentsStore.ts`. Pure functions: `addRecent`, `listRecents`, `removeRecent`, `getHandle(id)`, `getSnapshot(id)`.
10. localStorage wrapper for the index, IndexedDB wrapper for handles + snapshots.
11. Cap eviction logic (10 entries, ~1MB total).
12. Tests with mocked storage.

### Phase 4 — Dirty tracking
13. Add `savedSnapshotRef` + `markSaved()` + `isDirty` to `useUndoableAutomaton`.
14. Tests: dirty after edit, clean after save, clean after undo-back-to-saved.

### Phase 5 — Session hook
15. Create `useFileSession`. Orchestrates the above.
16. Tests with mocked adapter + store.

### Phase 6 — UI
17. Add `FILE` to `ToolTabID` in `src/components/toolMenu/types.ts`.
18. Create `FilePanel.tsx`. New/Open/Save/SaveAs buttons + Recents list.
19. Wire into `ToolMenu.tsx`'s tab content slot.
20. Confirm dialog component (popover-styled).
21. `beforeunload` listener in App.tsx, gated on `isDirty`.
22. Remove old `handleExportJSON` from ConfigPanel.

### Phase 7 — Keyboard shortcuts
23. `useFileShortcuts` hook. Cmd/Ctrl+S, Cmd/Ctrl+Shift+S, Cmd/Ctrl+O, Cmd/Ctrl+N.
24. Gate to EDIT mode (matches undo/redo gating).

### Phase 8 — End-to-end test
25. RTL test: render app, type into the canvas, save, modify, hit "New" → confirm appears → discard → verify clean state.

## Success criteria

- User can save the current automaton to a file (Chrome: in-place; others: download).
- User can open a saved file; automaton loads correctly with all transitions, alphabet, accept states, start state preserved.
- Recents list shows up to 10 recent files; clicking opens via handle (if granted) or snapshot.
- Dirty indicator shows in the File tab when there are unsaved changes.
- Confirm dialog appears before destructive nav when dirty; not when clean.
- ⌘S/⌘O/⌘N work in EDIT mode; don't fire elsewhere.
- All existing tests still green. Test count: **~380 → ~430**.
- `tsc --noEmit` clean.

## Risks

- **`FileSystemFileHandle` IndexedDB serialization.** Browser-spec compliant but Safari doesn't implement the API at all (so handle storage is moot there). Mitigation: capability-detect at recents-write time; if handle isn't supported, skip handle-store and rely on snapshot-only.
- **`beforeunload` reliability.** Browsers throttle/ignore the prompt aggressively. Mitigation: don't promise users it'll always fire; document it as best-effort. The save-explicit-before-close UX is the real protection.
- **Snapshot cache size.** 10 × ~100KB worst case = 1MB. localStorage limit is ~5MB; IDB much higher. Should be fine. Mitigation: cap individual snapshots at 250KB; refuse to cache larger files.
- **Concurrency between two tabs.** If user has the same file open in two tabs and saves in both, the FS Access handle in tab 2 will write over tab 1's save. Out of scope; we accept last-write-wins.

## Out of scope / future

- **Migration v1 → v2.** Scaffolded but no v2 to migrate to yet.
- **CSV / DOT / image import.** JSON only this iteration.
- **Test cases bundled in file.** `sample-dfa.json` already has a `testCases` field but the editor doesn't surface them; integrating the test-case UI is iter-17+.
- **Sharing via URL.** That's iter-19.
- **Auto-save.** Manual save only this iteration.
