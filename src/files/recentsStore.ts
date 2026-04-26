/**
 * Recents store — tracks the last N opened/saved automaton files in
 * localStorage. Each entry carries a content snapshot so reopening
 * works even if the underlying file moved or the browser is offline
 * (the FS Access handle reattachment for live-file reads is deferred
 * to a future iteration; iter-15 ships snapshot-only).
 *
 * Cap: 10 entries by count, ~1MB by total size. On overflow, the
 * oldest entries (by `openedAt`) are evicted FIFO until both caps
 * are satisfied.
 *
 * Storage key: `automata-recents-v1`. The `-v1` suffix is for forward
 * compat — if the stored shape changes, bump to `-v2` and ignore the
 * old key (no migration; recents are recoverable from disk by the
 * user re-opening the file).
 */

const STORAGE_KEY = 'automata-recents-v1';
const MAX_ENTRIES = 10;
const MAX_TOTAL_BYTES = 1_000_000;
const MAX_PER_ENTRY_BYTES = 250_000;

export type RecentEntry = {
  id: string;          // crypto.randomUUID() at first save/open
  name: string;        // display name (filename, with or without extension)
  savedAt: string;     // ISO-8601 of last save; empty string if never saved this session
  openedAt: string;    // ISO-8601 of last open
  sizeBytes: number;   // length of the snapshot string
  snapshot: string;    // serialized AutomataFile content
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readAll(): RecentEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
}

function isValidEntry(value: unknown): value is RecentEntry {
  if (value === null || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.savedAt === 'string' &&
    typeof v.openedAt === 'string' &&
    typeof v.sizeBytes === 'number' &&
    typeof v.snapshot === 'string'
  );
}

function writeAll(entries: RecentEntry[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // QuotaExceededError or similar — silently drop. Recents is a
    // convenience layer; the canonical state is the file on disk.
  }
}

function evictToFit(entries: RecentEntry[]): RecentEntry[] {
  // Sort by openedAt descending (newest first) so eviction (from the
  // end) drops oldest.
  const sorted = [...entries].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  let total = sorted.reduce((sum, e) => sum + e.sizeBytes, 0);
  while (sorted.length > MAX_ENTRIES || (total > MAX_TOTAL_BYTES && sorted.length > 0)) {
    const evicted = sorted.pop();
    if (!evicted) break;
    total -= evicted.sizeBytes;
  }
  return sorted;
}

export function listRecents(): RecentEntry[] {
  return readAll().sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

/**
 * Record an opened or saved file. If an entry with the same `name`
 * already exists, it's updated in place (snapshot, openedAt, optionally
 * savedAt). Otherwise a new entry is created.
 *
 * Returns the entry id (newly minted or existing).
 */
export function recordRecent(args: {
  name: string;
  snapshot: string;
  saved: boolean;
}): string | null {
  if (args.snapshot.length > MAX_PER_ENTRY_BYTES) return null;
  const now = new Date().toISOString();
  const existing = readAll();
  const same = existing.find((e) => e.name === args.name);
  let nextId: string;
  let next: RecentEntry[];
  if (same) {
    nextId = same.id;
    next = existing.map((e) =>
      e.id === same.id
        ? {
            ...e,
            snapshot: args.snapshot,
            sizeBytes: args.snapshot.length,
            openedAt: now,
            savedAt: args.saved ? now : e.savedAt,
          }
        : e
    );
  } else {
    nextId = newId();
    next = [
      ...existing,
      {
        id: nextId,
        name: args.name,
        snapshot: args.snapshot,
        sizeBytes: args.snapshot.length,
        openedAt: now,
        savedAt: args.saved ? now : '',
      },
    ];
  }
  writeAll(evictToFit(next));
  return nextId;
}

export function removeRecent(id: string): void {
  const next = readAll().filter((e) => e.id !== id);
  writeAll(next);
}

export function getRecent(id: string): RecentEntry | null {
  return readAll().find((e) => e.id === id) ?? null;
}

export function clearRecents(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Some test environments stub localStorage without removeItem;
    // fall back to overwriting with an empty list.
    try {
      window.localStorage.setItem(STORAGE_KEY, '[]');
    } catch {
      // Give up silently — clear is best-effort.
    }
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Cheap fallback for non-secure contexts (vanishingly rare in
  // browsers; jsdom may or may not have crypto.randomUUID depending on
  // version). Not cryptographically random — just unique enough for an
  // in-memory recents list.
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Exposed for tests.
export const RECENTS_STORAGE_KEY = STORAGE_KEY;
export const RECENTS_MAX_ENTRIES = MAX_ENTRIES;
export const RECENTS_MAX_TOTAL_BYTES = MAX_TOTAL_BYTES;
export const RECENTS_MAX_PER_ENTRY_BYTES = MAX_PER_ENTRY_BYTES;
