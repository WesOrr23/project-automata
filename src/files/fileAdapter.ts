/**
 * File adapter — abstraction over the browser's file save/load
 * primitives. The MVP iter-15 ships only the universal blob-download
 * adapter; a File System Access API adapter (for save-in-place on
 * Chromium) is a future iteration.
 *
 * The interface returns Result<T> for consistency with the engine
 * error model. `cancelled` is a normal outcome (user closed the file
 * picker), not an error condition the UI should toast about — but the
 * Result wrapper still uses the err branch so consumers can short-
 * circuit cleanly.
 */

import { Result, ok, err } from '../engine/result';

export type SavePayload = {
  /** Stringified content to write. */
  content: string;
  /** Filename suggestion shown in the save dialog. */
  suggestedName: string;
};

export type SaveOutcome = {
  /** The actual filename used (the user may have changed the suggestion). */
  name: string;
};

export type OpenOutcome = {
  name: string;
  content: string;
};

export interface FileAdapter {
  save(payload: SavePayload): Promise<Result<SaveOutcome>>;
  open(): Promise<Result<OpenOutcome>>;
}

/**
 * Universal blob-download adapter. Save = trigger a download via an
 * <a download> click. Open = synthesize a hidden <input type="file">,
 * click it, and read the chosen file.
 *
 * Save: filename is fixed to the suggestedName; the browser handles
 * the actual save dialog (or just downloads silently into the user's
 * Downloads folder, depending on browser settings).
 *
 * Open: returns a Promise that resolves on file selection or rejects
 * on cancel. Browsers don't surface a "user cancelled the picker"
 * event reliably, so we use a focus-back fallback (if the input still
 * has no files after the window regains focus, we treat it as cancel).
 */
export const blobDownloadAdapter: FileAdapter = {
  async save({ content, suggestedName }) {
    try {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = suggestedName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      return ok({ name: suggestedName });
    } catch {
      return err('file-read-failed');
    }
  },

  async open() {
    return new Promise<Result<OpenOutcome>>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.style.display = 'none';

      let settled = false;
      const settle = (result: Result<OpenOutcome>) => {
        if (settled) return;
        settled = true;
        if (input.parentNode) input.parentNode.removeChild(input);
        window.removeEventListener('focus', cancelHandler);
        resolve(result);
      };

      // Cancel detection: when focus returns to the window, if no file
      // was chosen, treat it as cancel. Wrapped in a setTimeout so the
      // change event has a chance to fire first.
      const cancelHandler = () => {
        setTimeout(() => {
          if (input.files && input.files.length > 0) return;
          settle(err('file-cancelled'));
        }, 200);
      };

      input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) {
          settle(err('file-cancelled'));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const text = typeof reader.result === 'string' ? reader.result : '';
          settle(ok({ name: file.name, content: text }));
        };
        reader.onerror = () => settle(err('file-read-failed'));
        reader.readAsText(file);
      });

      window.addEventListener('focus', cancelHandler);
      document.body.appendChild(input);
      input.click();
    });
  },
};

/**
 * Factory — returns the appropriate adapter for the current browser.
 * For now always returns the blob-download adapter; the FS Access
 * branch is a future iteration.
 */
export function createFileAdapter(): FileAdapter {
  return blobDownloadAdapter;
}
