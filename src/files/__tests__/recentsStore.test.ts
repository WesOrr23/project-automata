/**
 * @vitest-environment jsdom
 *
 * Tests for the recents store. We stub localStorage with a Map-backed
 * implementation per-test to avoid relying on vitest+jsdom's
 * localStorage (which proved unreliable across versions).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  recordRecent,
  listRecents,
  getRecent,
  removeRecent,
  clearRecents,
  RECENTS_MAX_ENTRIES,
  RECENTS_MAX_PER_ENTRY_BYTES,
} from '../recentsStore';

function installLocalStorageStub(): void {
  const store = new Map<string, string>();
  const stub = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal('localStorage', stub);
  // Also patch window.localStorage for the isBrowser check.
  Object.defineProperty(window, 'localStorage', { value: stub, configurable: true });
}

describe('recentsStore', () => {
  beforeEach(() => {
    installLocalStorageStub();
    clearRecents();
  });

  it('records and lists a single entry', () => {
    const id = recordRecent({ name: 'one.json', snapshot: 'content', saved: true });
    expect(id).toBeTruthy();
    const recents = listRecents();
    expect(recents).toHaveLength(1);
    expect(recents[0]!.name).toBe('one.json');
    expect(recents[0]!.savedAt).not.toBe('');
  });

  it('lists most-recent first', async () => {
    recordRecent({ name: 'a.json', snapshot: 'a', saved: false });
    // small delay so openedAt timestamps differ
    await new Promise((r) => setTimeout(r, 5));
    recordRecent({ name: 'b.json', snapshot: 'b', saved: false });
    const recents = listRecents();
    expect(recents.map((r) => r.name)).toEqual(['b.json', 'a.json']);
  });

  it('updates in place when same name is re-recorded', () => {
    const id1 = recordRecent({ name: 'same.json', snapshot: 'v1', saved: false });
    const id2 = recordRecent({ name: 'same.json', snapshot: 'v2', saved: true });
    expect(id1).toBe(id2);
    const recents = listRecents();
    expect(recents).toHaveLength(1);
    expect(recents[0]!.snapshot).toBe('v2');
    expect(recents[0]!.savedAt).not.toBe('');
  });

  it('caps at MAX_ENTRIES, evicting oldest', async () => {
    for (let i = 0; i < RECENTS_MAX_ENTRIES + 3; i++) {
      recordRecent({ name: `f${i}.json`, snapshot: `c${i}`, saved: false });
      await new Promise((r) => setTimeout(r, 1));
    }
    const recents = listRecents();
    expect(recents.length).toBe(RECENTS_MAX_ENTRIES);
    // Oldest names (f0, f1, f2) should be evicted.
    expect(recents.find((r) => r.name === 'f0.json')).toBeUndefined();
  });

  it('refuses entries larger than MAX_PER_ENTRY_BYTES', () => {
    const big = 'x'.repeat(RECENTS_MAX_PER_ENTRY_BYTES + 1);
    const id = recordRecent({ name: 'big.json', snapshot: big, saved: false });
    expect(id).toBeNull();
    expect(listRecents()).toHaveLength(0);
  });

  it('getRecent returns the entry by id', () => {
    const id = recordRecent({ name: 'g.json', snapshot: 'g', saved: false });
    expect(id).not.toBeNull();
    const entry = getRecent(id!);
    expect(entry?.name).toBe('g.json');
  });

  it('getRecent returns null for unknown id', () => {
    expect(getRecent('does-not-exist')).toBeNull();
  });

  it('removeRecent drops the entry', () => {
    const id = recordRecent({ name: 'r.json', snapshot: 'r', saved: false });
    expect(id).not.toBeNull();
    removeRecent(id!);
    expect(listRecents()).toHaveLength(0);
  });

  it('clearRecents wipes everything', () => {
    recordRecent({ name: 'a.json', snapshot: 'a', saved: false });
    recordRecent({ name: 'b.json', snapshot: 'b', saved: false });
    clearRecents();
    expect(listRecents()).toHaveLength(0);
  });
});
