/**
 * @vitest-environment jsdom
 *
 * Tests for the settings store. Same Map-backed localStorage stub
 * pattern as the recents/telemetry tests because vitest+jsdom's built-
 * in localStorage is unreliable. Each test resets modules so we get a
 * fresh load-from-storage pass.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../types';

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
  // Belt-and-suspenders: clear the data-reduce-motion attribute so the
  // side-effect assertions start from a clean slate.
  document.body.removeAttribute('data-reduce-motion');
  vi.resetModules();
});

describe('settings store', () => {
  it('returns DEFAULT_SETTINGS when storage is fresh', async () => {
    const { getSettings } = await import('../store');
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('updateSetting writes through to localStorage and getSettings', async () => {
    const { getSettings, updateSetting } = await import('../store');
    expect(getSettings().reduceMotion).toBe(false);
    updateSetting('reduceMotion', true);
    expect(getSettings().reduceMotion).toBe(true);
    const stored = storage.get('automata.settings.v1');
    expect(stored).not.toBeUndefined();
    const parsed = JSON.parse(stored!) as { values: { reduceMotion: boolean } };
    expect(parsed.values.reduceMotion).toBe(true);
  });

  it('updateSetting is a no-op when the value is unchanged', async () => {
    const { getSettings, updateSetting, subscribe } = await import('../store');
    const listener = vi.fn();
    subscribe(listener);
    const before = getSettings().reduceMotion;
    updateSetting('reduceMotion', before);
    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribers fire on every real change', async () => {
    const { updateSetting, subscribe } = await import('../store');
    const listener = vi.fn();
    const unsubscribe = subscribe(listener);
    updateSetting('reduceMotion', true);
    updateSetting('confirmBeforeDelete', true);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    updateSetting('telemetryEnabled', false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('reloads the persisted values on module re-init', async () => {
    const first = await import('../store');
    first.updateSetting('confirmBeforeDelete', true);
    first.updateSetting('imageExportTransparent', true);
    vi.resetModules();
    const second = await import('../store');
    const settings = second.getSettings();
    expect(settings.confirmBeforeDelete).toBe(true);
    expect(settings.imageExportTransparent).toBe(true);
    // Untouched fields keep defaults.
    expect(settings.reduceMotion).toBe(false);
  });

  it('discards persisted data with a stale schema version', async () => {
    storage.set(
      'automata.settings.v1',
      JSON.stringify({ version: 999, values: { reduceMotion: true } })
    );
    const { getSettings } = await import('../store');
    expect(getSettings().reduceMotion).toBe(false); // back to default
  });

  it('survives garbled persisted JSON', async () => {
    storage.set('automata.settings.v1', 'not valid {{ json');
    const { getSettings } = await import('../store');
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('resetSettings restores defaults and persists', async () => {
    const { getSettings, updateSetting, resetSettings } = await import('../store');
    updateSetting('reduceMotion', true);
    updateSetting('telemetryEnabled', false);
    resetSettings();
    expect(getSettings()).toEqual(DEFAULT_SETTINGS);
    const stored = storage.get('automata.settings.v1');
    const parsed = JSON.parse(stored!) as { values: { reduceMotion: boolean; telemetryEnabled: boolean } };
    expect(parsed.values.reduceMotion).toBe(false);
    expect(parsed.values.telemetryEnabled).toBe(true);
  });

  it('reduceMotion side effect toggles body[data-reduce-motion]', async () => {
    const { updateSetting } = await import('../store');
    expect(document.body.getAttribute('data-reduce-motion')).toBeNull();
    updateSetting('reduceMotion', true);
    expect(document.body.getAttribute('data-reduce-motion')).toBe('true');
    updateSetting('reduceMotion', false);
    expect(document.body.getAttribute('data-reduce-motion')).toBeNull();
  });

  it('exposes a debug handle on window.__automata.settings', async () => {
    type AutomataDebugWindow = Window & {
      __automata?: { settings?: Record<string, unknown> };
    };
    await import('../store');
    const debugWindow = window as unknown as AutomataDebugWindow;
    expect(debugWindow.__automata?.settings).toBeDefined();
    expect(typeof debugWindow.__automata?.settings?.get).toBe('function');
    expect(typeof debugWindow.__automata?.settings?.update).toBe('function');
  });

  it('telemetryEnabled side effect propagates into the logger', async () => {
    const { updateSetting } = await import('../store');
    const { isLoggingEnabled } = await import('../../telemetry');
    updateSetting('telemetryEnabled', false);
    expect(isLoggingEnabled()).toBe(false);
    updateSetting('telemetryEnabled', true);
    expect(isLoggingEnabled()).toBe(true);
  });
});
