/**
 * Settings store — module-level singleton, mirrors the telemetry
 * logger's pattern (one-and-done initialization, defensive
 * localStorage, observer subscriptions for reactive consumers).
 *
 * Subscription model: `subscribe(listener)` returns an unsubscribe
 * function. The React hook in useSettings.ts subscribes on mount and
 * forces a re-render whenever the store updates. Non-React callers
 * (like the telemetry side-effect) can subscribe too.
 */

import {
  DEFAULT_SETTINGS,
  SETTINGS_SCHEMA_VERSION,
  type Settings,
} from './types';
import { setLoggingEnabled } from '../telemetry';

const STORAGE_KEY = 'automata.settings.v1';

type StoredEnvelope = {
  version: number;
  values: Partial<Settings>;
};

/**
 * Defensive Storage accessor — vitest+jsdom's localStorage has been
 * known to ship `undefined` getItem methods on the global. Same
 * pattern as in the telemetry logger so a single broken global
 * doesn't crash module-load.
 */
function safeLocalStorage(): Storage | null {
  try {
    const candidate = (globalThis as { localStorage?: Storage }).localStorage;
    if (candidate === undefined || candidate === null) return null;
    if (typeof candidate.getItem !== 'function') return null;
    if (typeof candidate.setItem !== 'function') return null;
    return candidate;
  } catch {
    return null;
  }
}

function loadFromStorage(): Settings {
  const storage = safeLocalStorage();
  if (storage === null) return { ...DEFAULT_SETTINGS };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<StoredEnvelope> | null;
    if (parsed === null || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    if (parsed.version !== SETTINGS_SCHEMA_VERSION) {
      return { ...DEFAULT_SETTINGS };
    }
    if (typeof parsed.values !== 'object' || parsed.values === null) {
      return { ...DEFAULT_SETTINGS };
    }
    // Merge over defaults — partial updates from older shapes still
    // get the new fields' defaults applied.
    return { ...DEFAULT_SETTINGS, ...parsed.values };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveToStorage(values: Settings): void {
  const storage = safeLocalStorage();
  if (storage === null) return;
  const envelope: StoredEnvelope = {
    version: SETTINGS_SCHEMA_VERSION,
    values,
  };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // ignore — quota or disabled storage
  }
}

let current: Settings = loadFromStorage();
const listeners = new Set<(settings: Settings) => void>();

/**
 * Apply runtime side effects from the current settings. Called once
 * at module-load and again after every update so the world matches.
 *
 * - reduceMotion → body[data-reduce-motion="true"]
 * - telemetryEnabled → setLoggingEnabled
 *
 * Other settings (confirmBeforeDelete, showDebugOverlayDefault,
 * imageExportTransparent) don't have side effects — consumers read
 * them at the appropriate moment via getSettings/useSettings.
 */
function applySideEffects(): void {
  if (typeof document !== 'undefined') {
    if (current.reduceMotion) {
      document.body.setAttribute('data-reduce-motion', 'true');
    } else {
      document.body.removeAttribute('data-reduce-motion');
    }
  }
  setLoggingEnabled(current.telemetryEnabled);
}

applySideEffects();

/** Read the current settings. Returns a frozen copy so callers can't
 *  mutate internal state. */
export function getSettings(): Readonly<Settings> {
  return current;
}

/**
 * Update one setting and broadcast to listeners. Persists immediately
 * — settings changes are infrequent (modal-driven), no debounce needed.
 */
export function updateSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): void {
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  saveToStorage(current);
  applySideEffects();
  for (const listener of listeners) listener(current);
}

/** Reset every setting to its default. */
export function resetSettings(): void {
  current = { ...DEFAULT_SETTINGS };
  saveToStorage(current);
  applySideEffects();
  for (const listener of listeners) listener(current);
}

/**
 * Subscribe to changes. Returns an unsubscribe function. The listener
 * is called with the new settings object after every update.
 */
export function subscribe(listener: (settings: Settings) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Test-only: reset both the in-memory state and the persisted state
 * to defaults without firing listeners. Don't use in production code.
 */
export function __resetForTests(): void {
  current = { ...DEFAULT_SETTINGS };
  const storage = safeLocalStorage();
  if (storage !== null) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  listeners.clear();
}

// Console handle on the same `window.__automata` namespace as the
// logger. Useful for development inspection / tweaking without the
// modal being open.
if (typeof window !== 'undefined') {
  type AutomataDebugWindow = Window & {
    __automata?: { settings?: Record<string, unknown> };
  };
  const debugWindow = window as AutomataDebugWindow;
  debugWindow.__automata = debugWindow.__automata ?? {};
  debugWindow.__automata.settings = {
    get: getSettings,
    update: updateSetting,
    reset: resetSettings,
  };
}
