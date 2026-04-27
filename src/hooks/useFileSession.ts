/**
 * useFileSession — orchestrates file save/load, recents, dirty
 * tracking, and the surrounding notification toasts.
 *
 * Owns no engine state of its own; reads + writes the snapshot via the
 * useUndoableAutomaton hook passed in, and reads the alphabet/start
 * state etc. from the current automaton at save time. Adapter and
 * recents-store are also dependencies — keeps the hook fully unit-
 * testable with mocks (no jsdom required for adapter calls).
 */

import { useCallback, useState, useEffect } from 'react';
import { Automaton } from '../engine/types';
import { errorMessage } from '../engine/result';
import {
  serializeAutomaton,
  parseAutomataFile,
  defaultMetadata,
  AutomataFileMetadata,
} from '../files/format';
import { FileAdapter } from '../files/fileAdapter';
import {
  listRecents,
  recordRecent,
  getRecent,
  removeRecent,
  RecentEntry,
} from '../files/recentsStore';

export type NotifyFn = (input: {
  severity: 'info' | 'success' | 'error';
  title: string;
  detail?: string;
  autoDismissMs?: number;
}) => void;

export type UseFileSessionArgs = {
  automaton: Automaton;
  epsilonSymbol: string;
  description: string;
  isDirty: boolean;
  markSaved: () => void;
  replaceSnapshot: (snapshot: { automaton: Automaton; epsilonSymbol: string; description: string }) => void;
  adapter: FileAdapter;
  notify: NotifyFn;
};

export type UseFileSessionResult = {
  /** Display name of the file currently open. null if untitled. */
  currentName: string | null;
  /** Save current automaton — uses currentName if set, else prompts. */
  save: () => Promise<void>;
  /** Save under a new name (always opens file picker). */
  saveAs: () => Promise<void>;
  /** Open a file from disk, replacing current state. Confirms if dirty. */
  openFile: () => Promise<void>;
  /** Reset to a fresh empty automaton. Confirms if dirty. */
  newFile: () => Promise<void>;
  /** Load a recent entry's snapshot directly. */
  openRecent: (id: string) => void;
  /** Remove a recent entry. */
  forgetRecent: (id: string) => void;
  /** Live recents list (re-read on each save/open). */
  recents: RecentEntry[];
  /** Inline rename: set the in-app filename without writing to disk.
   *  The new name will be the suggestedName for the next Save. */
  renameCurrent: (nextName: string) => void;
};

/**
 * Default factory for the empty/initial automaton. Caller-supplied
 * because what counts as "blank" depends on the app (e.g. whether to
 * include a single state, what the default ε-symbol is, etc.).
 */
export type NewFileFactory = () => { automaton: Automaton; epsilonSymbol: string; description: string };

const SUGGESTED_EXTENSION = '.json';

function normalizeName(raw: string): string {
  // Strip trailing extension for display; the on-disk filename keeps it.
  return raw.replace(/\.json$/i, '');
}

function suggestedFilename(name: string | null): string {
  const base = (name && name.trim().length > 0 ? name : 'automaton').replace(
    /[^A-Za-z0-9 _-]+/g,
    '_'
  );
  return base.endsWith(SUGGESTED_EXTENSION) ? base : `${base}${SUGGESTED_EXTENSION}`;
}

export function useFileSession(
  args: UseFileSessionArgs,
  newFileFactory: NewFileFactory
): UseFileSessionResult {
  const { automaton, epsilonSymbol, description, isDirty, markSaved, replaceSnapshot, adapter, notify } = args;
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentEntry[]>(() => listRecents());

  const refreshRecents = useCallback(() => {
    setRecents(listRecents());
  }, []);

  // beforeunload: warn the user only when there's unsaved work. The
  // browser's native confirm dialog text is not customizable in modern
  // browsers; setting returnValue is enough to trigger it.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const writeAutomaton = useCallback(
    async (filename: string) => {
      const meta: AutomataFileMetadata = {
        ...defaultMetadata(normalizeName(filename)),
        ...(currentName !== null ? { name: normalizeName(filename) } : {}),
        ...(description.length > 0 ? { description } : {}),
      };
      const content = serializeAutomaton(automaton, meta);
      const result = await adapter.save({ content, suggestedName: filename });
      if (!result.ok) {
        if (result.error !== 'file-cancelled') {
          notify({ severity: 'error', title: 'Save failed', detail: errorMessage(result.error) });
        }
        return;
      }
      setCurrentName(normalizeName(result.value.name));
      recordRecent({ name: result.value.name, snapshot: content, saved: true });
      refreshRecents();
      markSaved();
      notify({ severity: 'success', title: `Saved ${result.value.name}`, autoDismissMs: 3_000 });
    },
    [adapter, automaton, currentName, description, markSaved, notify, refreshRecents]
  );

  const save = useCallback(async () => {
    return writeAutomaton(suggestedFilename(currentName));
  }, [currentName, writeAutomaton]);

  const saveAs = useCallback(async () => {
    return writeAutomaton(suggestedFilename(currentName));
  }, [currentName, writeAutomaton]);

  const loadFromContent = useCallback(
    (content: string, displayName: string) => {
      const parsed = parseAutomataFile(content);
      if (!parsed.ok) {
        notify({ severity: 'error', title: 'Could not open file', detail: errorMessage(parsed.error) });
        return;
      }
      replaceSnapshot({
        automaton: parsed.value.automaton,
        // Loaded files don't carry a UI ε-symbol; preserve current to
        // minimize disruption (the symbol is per-session anyway).
        epsilonSymbol,
        // Description IS in the file metadata. Default to empty when
        // a file omits it (older saves, hand-written JSON, etc.).
        description: parsed.value.metadata.description ?? '',
      });
      setCurrentName(normalizeName(displayName));
      recordRecent({ name: displayName, snapshot: content, saved: false });
      refreshRecents();
      notify({ severity: 'success', title: `Opened ${displayName}`, autoDismissMs: 3_000 });
    },
    [epsilonSymbol, notify, refreshRecents, replaceSnapshot]
  );

  function confirmDiscardIfDirty(): boolean {
    if (!isDirty) return true;
    return window.confirm(
      'You have unsaved changes. Discard them and continue?'
    );
  }

  const openFile = useCallback(async () => {
    if (!confirmDiscardIfDirty()) return;
    const result = await adapter.open();
    if (!result.ok) {
      if (result.error !== 'file-cancelled') {
        notify({ severity: 'error', title: 'Open failed', detail: errorMessage(result.error) });
      }
      return;
    }
    loadFromContent(result.value.content, result.value.name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adapter, isDirty, loadFromContent, notify]);

  const newFile = useCallback(async () => {
    if (!confirmDiscardIfDirty()) return;
    replaceSnapshot(newFileFactory());
    setCurrentName(null);
    notify({ severity: 'info', title: 'Started new automaton', autoDismissMs: 2_000 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, newFileFactory, notify, replaceSnapshot]);

  const openRecent = useCallback(
    (id: string) => {
      if (!confirmDiscardIfDirty()) return;
      const entry = getRecent(id);
      if (!entry) {
        notify({ severity: 'error', title: 'Recent file is no longer available' });
        refreshRecents();
        return;
      }
      loadFromContent(entry.snapshot, entry.name);
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
    [isDirty, loadFromContent, notify, refreshRecents]
  );

  const forgetRecent = useCallback(
    (id: string) => {
      removeRecent(id);
      refreshRecents();
    },
    [refreshRecents]
  );

  // Inline rename — no disk write. The next Save uses this as the
  // suggestedName, so the rename is "applied" the next time the user
  // saves. We deliberately don't auto-save here: renaming an open
  // file in any desktop OS doesn't write a new file either.
  const renameCurrent = useCallback((nextName: string) => {
    const cleaned = nextName.trim();
    if (cleaned.length === 0) return;
    setCurrentName(normalizeName(cleaned));
  }, []);

  return {
    currentName,
    save,
    saveAs,
    openFile,
    newFile,
    openRecent,
    forgetRecent,
    recents,
    renameCurrent,
  };
}
