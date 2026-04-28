/**
 * @vitest-environment jsdom
 *
 * Tests for the telemetry logger. We stub localStorage with a Map-
 * backed implementation per-test (same pattern as recentsStore.test.ts)
 * — vitest + jsdom's built-in localStorage has been unreliable across
 * versions. Each test also resets the module via `vi.resetModules()`
 * so the logger re-runs its load-from-storage step on a clean slate.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

function installLocalStorageStub(): Map<string, string> {
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
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  vi.stubGlobal('localStorage', stub);
  Object.defineProperty(window, 'localStorage', {
    value: stub,
    configurable: true,
  });
  return store;
}

let storage: Map<string, string>;

beforeEach(() => {
  storage = installLocalStorageStub();
  vi.resetModules();
});

describe('telemetry logger', () => {
  it('starts with an empty log when storage is fresh', async () => {
    const { getLog } = await import('../logger');
    expect(getLog()).toEqual([]);
  });

  it('records events with type, timestamp, and optional payload', async () => {
    const { logEvent, getLog } = await import('../logger');
    const beforeTimestamp = Date.now();
    logEvent('state.added', { stateId: 7 });
    logEvent('mode.switched', { from: 'Construct', to: 'Simulate' });
    logEvent('undo'); // no payload

    const log = getLog();
    expect(log).toHaveLength(3);
    expect(log[0]?.type).toBe('state.added');
    expect(log[0]?.payload).toEqual({ stateId: 7 });
    expect(log[0]?.ts).toBeGreaterThanOrEqual(beforeTimestamp);
    expect(log[2]?.type).toBe('undo');
    expect(log[2]?.payload).toBeUndefined();
  });

  it('returns a defensive copy from getLog', async () => {
    const { logEvent, getLog } = await import('../logger');
    logEvent('a');
    const snapshot = getLog();
    snapshot.push({ ts: 0, type: 'mutated' });
    expect(getLog()).toHaveLength(1);
    expect(getLog()[0]?.type).toBe('a');
  });

  it('caps the buffer at LOG_CAP entries (drops oldest)', async () => {
    const { logEvent, getLog } = await import('../logger');
    // LOG_CAP is 500 internally; push 600 and assert we kept the
    // last 500.
    for (let i = 0; i < 600; i += 1) {
      logEvent('tick', { i });
    }
    const log = getLog();
    expect(log).toHaveLength(500);
    expect(log[0]?.payload).toEqual({ i: 100 });
    expect(log[499]?.payload).toEqual({ i: 599 });
  });

  it('clearLog wipes both memory and localStorage', async () => {
    const { logEvent, clearLog, getLog } = await import('../logger');
    logEvent('a');
    logEvent('b');
    // Force a flush to populate localStorage; the debounce makes us wait.
    vi.useFakeTimers();
    logEvent('c');
    vi.advanceTimersByTime(1500);
    vi.useRealTimers();

    expect(storage.get('automata.telemetry.log') ?? null).not.toBeNull();

    clearLog();
    expect(getLog()).toEqual([]);
    expect(storage.get('automata.telemetry.log') ?? null).toBeNull();
  });

  it('persists to localStorage after the debounce interval', async () => {
    vi.useFakeTimers();
    const { logEvent } = await import('../logger');
    logEvent('persisted');
    // Before the debounce fires, storage should still be empty.
    expect(storage.get('automata.telemetry.log') ?? null).toBeNull();
    vi.advanceTimersByTime(1500);
    const stored = storage.get('automata.telemetry.log') ?? null;
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!) as Array<{ type: string }>;
    expect(parsed[0]?.type).toBe('persisted');
    vi.useRealTimers();
  });

  it('reloads previous events from localStorage on module init', async () => {
    // Pre-populate storage as if a previous session had logged events.
    const seed = [
      { ts: 1000, type: 'previous.event', payload: { x: 1 } },
      { ts: 2000, type: 'another' },
    ];
    storage.set('automata.telemetry.log',JSON.stringify(seed));

    const { getLog } = await import('../logger');
    const log = getLog();
    expect(log).toHaveLength(2);
    expect(log[0]?.type).toBe('previous.event');
    expect(log[1]?.ts).toBe(2000);
  });

  it('survives garbled localStorage JSON', async () => {
    storage.set('automata.telemetry.log','not valid json {{{');
    const { getLog, logEvent } = await import('../logger');
    expect(getLog()).toEqual([]);
    // Should still be usable after the recovery.
    logEvent('after.recovery');
    expect(getLog()).toHaveLength(1);
  });

  it('drops obviously-malformed entries from a stored array', async () => {
    const seed = [
      { ts: 1, type: 'good' },
      { type: 'no-timestamp' },          // missing ts
      { ts: 2 },                          // missing type
      { ts: 3, type: 'also-good' },
      'a string',                         // not even an object
      null,
    ];
    storage.set('automata.telemetry.log',JSON.stringify(seed));
    const { getLog } = await import('../logger');
    const log = getLog();
    expect(log).toHaveLength(2);
    expect(log[0]?.type).toBe('good');
    expect(log[1]?.type).toBe('also-good');
  });

  it('skips logging when disabled, resumes when re-enabled', async () => {
    const { logEvent, setLoggingEnabled, isLoggingEnabled, getLog } =
      await import('../logger');
    expect(isLoggingEnabled()).toBe(true);
    logEvent('before');
    setLoggingEnabled(false);
    expect(isLoggingEnabled()).toBe(false);
    logEvent('skipped');
    setLoggingEnabled(true);
    logEvent('after');
    const log = getLog();
    expect(log.map((e) => e.type)).toEqual(['before', 'after']);
  });

  it('persists the disabled flag across module re-init', async () => {
    const first = await import('../logger');
    first.setLoggingEnabled(false);
    expect(storage.get('automata.telemetry.enabled') ?? null).toBe('false');
    vi.resetModules();
    const second = await import('../logger');
    expect(second.isLoggingEnabled()).toBe(false);
  });

  it('exposes a debug handle on window.__automata.logger', async () => {
    type AutomataDebugWindow = Window & {
      __automata?: { logger?: Record<string, unknown> };
    };
    await import('../logger');
    const debugWindow = window as unknown as AutomataDebugWindow;
    expect(debugWindow.__automata?.logger).toBeDefined();
    expect(typeof debugWindow.__automata?.logger?.getLog).toBe('function');
    expect(typeof debugWindow.__automata?.logger?.downloadLog).toBe('function');
  });
});
