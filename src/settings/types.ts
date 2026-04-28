/**
 * User settings — the long-tail config surface.
 *
 * Things that DON'T belong here:
 *   - Per-automaton state (alphabet, type, transitions) — that's the
 *     undoable engine state, not user prefs
 *   - Session UI state (which tab is active, modal open/closed) —
 *     that's transient, lives in component state
 *   - Per-file metadata (description, name) — saved in the file itself
 *
 * Things that DO belong here:
 *   - Cross-session preferences ("turn off animations", "always
 *     export with transparent background")
 *   - Privacy toggles ("disable telemetry")
 *   - Defaults that influence new sessions ("start with debug overlay
 *     visible")
 *
 * Each setting needs a default. Adding a new setting:
 *   1. Add the field + JSDoc here
 *   2. Add a default to DEFAULT_SETTINGS
 *   3. (If it has a side effect — like reduceMotion toggling a body
 *      class) add an applier in store.ts's `applySideEffects`
 *   4. Add a UI control to SettingsModal
 *
 * Versioning: bump SETTINGS_SCHEMA_VERSION when the shape changes in a
 * non-additive way. The loader will throw away old data on mismatch.
 */

export type Settings = {
  /** When false, logEvent() in the telemetry module no-ops. The
   *  in-memory log keeps existing entries but stops accumulating. */
  telemetryEnabled: boolean;

  /** When true, the body picks up `data-reduce-motion="true"` and the
   *  CSS layer suspends the breath/pulse animations on idle elements.
   *  Useful for users with motion sensitivity. */
  reduceMotion: boolean;

  /** When true, destructive engine ops (remove state, remove
   *  transition) prompt for confirmation before applying. The default
   *  is false because undo/redo already covers most accidents. */
  confirmBeforeDelete: boolean;

  /** Whether the debug overlay (cluster center marker, viewport
   *  diagnostics) starts visible on app load. ⌘⇧D still toggles at
   *  runtime regardless of this default. */
  showDebugOverlayDefault: boolean;

  /** Default value of the "transparent background" option in the image
   *  exporter. The exporter still has its own per-export toggle. */
  imageExportTransparent: boolean;
};

/**
 * Defaults. Every field of `Settings` MUST appear here — TypeScript
 * will flag a missing key (the type signature `: Settings` enforces
 * exhaustiveness).
 */
export const DEFAULT_SETTINGS: Settings = {
  telemetryEnabled: true,
  reduceMotion: false,
  confirmBeforeDelete: false,
  showDebugOverlayDefault: false,
  imageExportTransparent: false,
};

/**
 * Bump when the Settings shape changes in a way the old loader can't
 * cope with. The loader compares the persisted version against this
 * constant and discards everything on mismatch (settings reset to
 * defaults — better than crashing on a stray field). Pure additions
 * (new optional field with a default) DON'T require a bump.
 */
export const SETTINGS_SCHEMA_VERSION = 1;
