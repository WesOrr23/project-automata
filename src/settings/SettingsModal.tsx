/**
 * SettingsModal — the user-facing surface for the settings store.
 *
 * Opens via ⌘, (Mac convention for app preferences) — wired in App.tsx.
 * No visible button affordance yet; the iter plan is to surface it
 * once the settings list is large enough to justify the chrome.
 *
 * Visual language matches BatchTestModal: dim overlay, centered card,
 * Esc dismisses (capture-true so it beats menu-collapse), backdrop
 * click dismisses, X button dismisses. Each setting is a labelled row
 * with a control on the right.
 */

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useKeyboardScope } from '../hooks/useKeyboardScope';
import { useSettings } from './useSettings';

type SettingsModalProp = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: SettingsModalProp) {
  const { settings, update, reset } = useSettings();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Focus the close button on open so keyboard-only users have a
  // sensible starting tab target. (Same pattern as BatchTestModal.)
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  // Esc dismisses. Capture-true: this is a modal and Esc should close
  // THIS first, never escape past it to the global menu-collapse path.
  useKeyboardScope({
    id: 'settings-modal-esc',
    active: open,
    capture: true,
    onKey: (event) => {
      if (event.key !== 'Escape') return false;
      event.preventDefault();
      onClose();
      return true;
    },
  });

  function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === overlayRef.current) onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="settings-overlay"
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="presentation"
        >
          <motion.div
            className="settings-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <header className="settings-header">
              <h2 id="settings-title" className="settings-title">
                Settings
              </h2>
              <button
                ref={closeButtonRef}
                className="settings-close"
                onClick={onClose}
                aria-label="Close settings"
                type="button"
              >
                <X size={16} />
              </button>
            </header>

            <p className="settings-hint">
              These are infrequent preferences — animation, privacy,
              and exporter defaults. ⌘, opens this; Esc closes.
            </p>

            <section className="settings-section">
              <h3 className="settings-section-title">General</h3>

              <ToggleRow
                label="Confirm before delete"
                description="Show a confirmation dialog before removing states or transitions. Off by default — undo/redo already covers most accidents."
                checked={settings.confirmBeforeDelete}
                onChange={(value) => update('confirmBeforeDelete', value)}
              />
            </section>

            <section className="settings-section">
              <h3 className="settings-section-title">Display</h3>

              <ToggleRow
                label="Reduce motion"
                description="Suspend the idle breathing animations on the start arrow, accept ring, and pickable state nodes. Useful if motion is distracting."
                checked={settings.reduceMotion}
                onChange={(value) => update('reduceMotion', value)}
              />

              <ToggleRow
                label="Show debug overlay by default"
                description="Start with the debug overlay (cluster center marker, viewport diagnostics) visible. ⌘⇧D still toggles at runtime."
                checked={settings.showDebugOverlayDefault}
                onChange={(value) => update('showDebugOverlayDefault', value)}
              />
            </section>

            <section className="settings-section">
              <h3 className="settings-section-title">Image Export</h3>

              <ToggleRow
                label="Transparent background by default"
                description="When on, image exports use a transparent background instead of white. The exporter UI still has its own per-export toggle."
                checked={settings.imageExportTransparent}
                onChange={(value) => update('imageExportTransparent', value)}
              />
            </section>

            <section className="settings-section">
              <h3 className="settings-section-title">Privacy</h3>

              <ToggleRow
                label="Telemetry enabled"
                description="When on, we record an in-browser timeline of your actions (state added, simulate run, etc.). Stays on your device — never sent anywhere — and you can inspect or download it via the developer console: window.__automata.logger.downloadLog()."
                checked={settings.telemetryEnabled}
                onChange={(value) => update('telemetryEnabled', value)}
              />
            </section>

            <footer className="settings-footer">
              <button
                type="button"
                className="settings-reset-button"
                onClick={reset}
              >
                Reset to defaults
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * One row in the settings list — label + description on the left, a
 * toggle on the right. Pure presentational; receives controlled
 * checked + onChange.
 */
function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="settings-row">
      <div className="settings-row-text">
        <div className="settings-row-label">{label}</div>
        <div className="settings-row-description">{description}</div>
      </div>
      <input
        type="checkbox"
        className="settings-row-toggle"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
