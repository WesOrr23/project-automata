/**
 * Telemetry — a behind-the-scenes event log of what the user does.
 *
 * Why: when the friend in the user-test session said "I tried to do X
 * but it didn't work," we had to reconstruct the path from memory. A
 * timestamped log of every meaningful user action makes that easier
 * (for us in development; eventually it'd be opt-in for actual users).
 *
 * Design — deliberately small:
 *   - One module-level singleton (no React provider, no context tree)
 *   - Single API: `logEvent(type, payload?)`
 *   - In-memory ring buffer capped at LOG_CAP entries
 *   - Debounced flush to localStorage so a crash doesn't lose the
 *     last few seconds of activity
 *   - Loadable inspector: `window.__automata.logger.getLog()` etc.
 *
 * Event types are plain strings (e.g. `"state.added"`) so adding a new
 * event is a one-liner at the call site — no central enum to update.
 * Keep names dotted-namespace style (`<area>.<verb>`) so the log groups
 * naturally when sorted.
 *
 * NOT in scope here: aggregation, reporting, network upload. The point
 * is collection. What we do with the log later is a separate problem.
 */

export type TelemetryEvent = {
  /** epoch ms */
  ts: number;
  /** dotted namespace, e.g. "state.added", "simulate.run" */
  type: string;
  /** arbitrary structured payload — keep small and JSON-safe */
  payload?: Record<string, unknown>;
};

/** Max events kept in memory + persisted. Older ones drop off the front. */
const LOG_CAP = 500;
const STORAGE_KEY = 'automata.telemetry.log';
const ENABLED_KEY = 'automata.telemetry.enabled';
/** ms to wait after the last event before flushing to localStorage. */
const FLUSH_DEBOUNCE_MS = 1000;

/**
 * Pull a usable Storage out of `globalThis` (or `window`) — but ONLY if
 * it actually quacks like one. vitest + jsdom has historically shipped
 * a partially-implemented localStorage that fails on `.getItem()` calls
 * even though the global is defined; that breaks tests for any module
 * that imports the logger transitively. So we do a runtime smoke test
 * (not a typeof check) before we trust it.
 *
 * Returns `null` when storage is missing OR doesn't behave like
 * Storage; callers MUST handle null.
 */
function safeLocalStorage(): Storage | null {
  try {
    const candidate = (globalThis as { localStorage?: Storage }).localStorage;
    if (candidate === undefined || candidate === null) return null;
    if (typeof candidate.getItem !== 'function') return null;
    if (typeof candidate.setItem !== 'function') return null;
    if (typeof candidate.removeItem !== 'function') return null;
    return candidate;
  } catch {
    return null;
  }
}

let buffer: TelemetryEvent[] = loadFromStorage();
let enabled: boolean = loadEnabledFlag();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function loadFromStorage(): TelemetryEvent[] {
  const storage = safeLocalStorage();
  if (storage === null) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: trust the array but reject garbled entries.
    return parsed.filter(
      (event): event is TelemetryEvent =>
        typeof event === 'object' &&
        event !== null &&
        typeof event.ts === 'number' &&
        typeof event.type === 'string'
    );
  } catch {
    return [];
  }
}

function loadEnabledFlag(): boolean {
  const storage = safeLocalStorage();
  if (storage === null) return true;
  try {
    return storage.getItem(ENABLED_KEY) !== 'false';
  } catch {
    return true;
  }
}

function scheduleFlush(): void {
  if (safeLocalStorage() === null) return;
  if (flushTimer !== null) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushNow, FLUSH_DEBOUNCE_MS);
}

function flushNow(): void {
  const storage = safeLocalStorage();
  if (storage === null) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(buffer));
  } catch {
    // Quota exceeded or storage disabled — drop silently.
    // Worst case: in-memory log keeps working, only persistence breaks.
  }
  flushTimer = null;
}

/**
 * Record one event. Cheap; safe to call from hot paths (tens-of-events
 * per second is fine — only the localStorage flush is debounced).
 *
 * Pass `payload` only if it carries information that won't be obvious
 * from `type` alone. Keep payloads small and JSON-safe (no functions,
 * no DOM nodes, no Sets — convert to arrays first).
 */
export function logEvent(type: string, payload?: Record<string, unknown>): void {
  if (!enabled) return;
  const event: TelemetryEvent = payload === undefined
    ? { ts: Date.now(), type }
    : { ts: Date.now(), type, payload };
  buffer.push(event);
  if (buffer.length > LOG_CAP) {
    buffer = buffer.slice(buffer.length - LOG_CAP);
  }
  scheduleFlush();
}

/** Read the in-memory log. Returns a defensive copy so callers can't
 *  mutate internal state. */
export function getLog(): TelemetryEvent[] {
  return buffer.slice();
}

/** Drop everything, both in memory and in localStorage. */
export function clearLog(): void {
  buffer = [];
  const storage = safeLocalStorage();
  if (storage !== null) {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/** Download the current log as a JSON file. Convenience for `window.__automata`
 *  console use; not wired into any UI. */
export function downloadLog(filename?: string): void {
  if (typeof document === 'undefined') return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = filename ?? `automata-log-${stamp}.json`;
  const blob = new Blob([JSON.stringify(buffer, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function setLoggingEnabled(value: boolean): void {
  enabled = value;
  const storage = safeLocalStorage();
  if (storage !== null) {
    try {
      storage.setItem(ENABLED_KEY, value ? 'true' : 'false');
    } catch {
      // ignore
    }
  }
  if (!value) {
    // When the user opts out, drop pending writes too.
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  }
}

export function isLoggingEnabled(): boolean {
  return enabled;
}

/** Best-effort flush on page hide / unload so we don't lose the last
 *  ~1 second of events. Browsers throttle synchronous work in
 *  beforeunload, but localStorage.setItem of a few hundred small
 *  events is well within budget. */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushNow);
  // Pagehide fires even when the tab is bfcache'd; beforeunload doesn't.
  window.addEventListener('pagehide', flushNow);

  // Expose a debug handle for console inspection. Namespaced under
  // `__automata` so future debug surfaces (debug overlay, settings,
  // etc.) can hang off the same object without polluting globals.
  type AutomataDebugWindow = Window & {
    __automata?: { logger?: Record<string, unknown> };
  };
  const debugWindow = window as AutomataDebugWindow;
  debugWindow.__automata = debugWindow.__automata ?? {};
  debugWindow.__automata.logger = {
    getLog,
    clearLog,
    downloadLog,
    setLoggingEnabled,
    isLoggingEnabled,
  };
}
