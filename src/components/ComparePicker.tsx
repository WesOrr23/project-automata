/**
 * ComparePicker — popover dialog for picking a second automaton to
 * compare the current one against (DFA equivalence checking).
 *
 * Two paths in:
 *   1. A recent file from the picker list. Each recent's snapshot is
 *      parsed on-demand and validated (DFA + complete + alphabet
 *      matches the current automaton's). Invalid recents render
 *      disabled with a tooltip explaining why.
 *   2. "Open another file…" → standard file-adapter open flow.
 *
 * Result is dispatched via `onPicked(otherAutomaton, displayName)` and
 * the picker closes itself. Errors (parse failures, file open
 * cancellation) are reported via `notify` and the picker stays open
 * so the user can try a different option.
 */

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, FolderOpen } from 'lucide-react';
import type { RecentEntry } from '../files/recentsStore';
import type { FileAdapter } from '../files/fileAdapter';
import { useKeyboardScope } from '../hooks/useKeyboardScope';
import type { Automaton } from '../engine/types';
import { parseAutomataFile } from '../files/format';
import { isComplete } from '../engine/validator';
import { errorMessage } from '../engine/result';

export type NotifyFn = (input: {
  severity: 'info' | 'success' | 'error';
  title: string;
  detail?: string;
  autoDismissMs?: number;
}) => void;

type ComparePickerProp = {
  visible: boolean;
  /** The current (left-hand) automaton; used to validate same-alphabet. */
  current: Automaton;
  recents: ReadonlyArray<RecentEntry>;
  adapter: FileAdapter;
  onPicked: (other: Automaton, displayName: string) => void;
  onClose: () => void;
  notify: NotifyFn;
};

type RecentEvaluation = {
  entry: RecentEntry;
  loadable: boolean;
  reason?: string;
  parsedAutomaton?: Automaton;
};

function evaluateRecent(entry: RecentEntry, current: Automaton): RecentEvaluation {
  const parsed = parseAutomataFile(entry.snapshot);
  if (!parsed.ok) {
    return { entry, loadable: false, reason: errorMessage(parsed.error) };
  }
  const a = parsed.value.automaton;
  if (a.type !== 'DFA') {
    return { entry, loadable: false, reason: 'Not a DFA' };
  }
  if (!isComplete(a)) {
    return { entry, loadable: false, reason: 'Incomplete DFA' };
  }
  if (current.alphabet.size !== a.alphabet.size) {
    return { entry, loadable: false, reason: 'Different alphabet' };
  }
  for (const sym of current.alphabet) {
    if (!a.alphabet.has(sym)) {
      return { entry, loadable: false, reason: 'Different alphabet' };
    }
  }
  return { entry, loadable: true, parsedAutomaton: a };
}

export function ComparePicker({
  visible,
  current,
  recents,
  adapter,
  onPicked,
  onClose,
  notify,
}: ComparePickerProp) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Outside-click closes. Mouse listener stays raw (no scope-stack
  // for mouse events).
  useEffect(() => {
    if (!visible) return;
    function handlePointerDown(event: MouseEvent) {
      const node = ref.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [visible, onClose]);

  // Esc closes. Capture-true since this is modal-flavored — the
  // picker should preempt other Esc handlers (CommandBar popover Esc,
  // batch test Esc, etc.) when it's the topmost open surface.
  useKeyboardScope({
    id: 'compare-picker-esc',
    active: visible,
    capture: true,
    onKey: (event) => {
      if (event.key !== 'Escape') return false;
      event.preventDefault();
      onClose();
      return true;
    },
  });

  async function handleOpenAnother() {
    const result = await adapter.open();
    if (!result.ok) {
      if (result.error !== 'file-cancelled') {
        notify({ severity: 'error', title: 'Open failed', detail: errorMessage(result.error) });
      }
      return;
    }
    const parsed = parseAutomataFile(result.value.content);
    if (!parsed.ok) {
      notify({ severity: 'error', title: 'Could not parse file', detail: errorMessage(parsed.error) });
      return;
    }
    const other = parsed.value.automaton;
    if (other.type !== 'DFA') {
      notify({ severity: 'error', title: 'File is not a DFA', detail: 'Equivalence requires both sides to be DFAs.' });
      return;
    }
    if (!isComplete(other)) {
      notify({ severity: 'error', title: 'File DFA is incomplete', detail: 'Equivalence requires both DFAs to be complete.' });
      return;
    }
    let alphabetMatches = current.alphabet.size === other.alphabet.size;
    if (alphabetMatches) {
      for (const sym of current.alphabet) {
        if (!other.alphabet.has(sym)) { alphabetMatches = false; break; }
      }
    }
    if (!alphabetMatches) {
      notify({ severity: 'error', title: 'Alphabet mismatch', detail: 'The two DFAs must share the same alphabet.' });
      return;
    }
    onPicked(other, result.value.name);
  }

  const evaluatedRecents = recents.map((r) => evaluateRecent(r, current));

  return (
    <AnimatePresence mode="popLayout">
      {visible && (
        <motion.div
          ref={ref}
          className="compare-picker"
          role="dialog"
          aria-label="Compare against another automaton"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="compare-picker-header">
            <span className="compare-picker-title">Compare against…</span>
            <button
              type="button"
              className="compare-picker-close"
              onClick={onClose}
              aria-label="Close comparison picker"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>

          <button
            type="button"
            className="compare-picker-open-button"
            onClick={handleOpenAnother}
            title="Open a file from disk"
          >
            <FolderOpen size={14} />
            <span>Open another file…</span>
          </button>

          <div className="compare-picker-section">
            <span className="compare-picker-section-label">Recents</span>
            {evaluatedRecents.length === 0 ? (
              <div className="compare-picker-empty">No recent files.</div>
            ) : (
              <ul className="compare-picker-recents">
                {evaluatedRecents.map(({ entry, loadable, reason, parsedAutomaton }) => (
                  <li key={entry.id} className="compare-picker-recent">
                    <button
                      type="button"
                      className="compare-picker-recent-button"
                      disabled={!loadable}
                      title={loadable ? `Compare against ${entry.name}` : reason}
                      onClick={() => {
                        if (parsedAutomaton) onPicked(parsedAutomaton, entry.name);
                      }}
                    >
                      <span className="compare-picker-recent-name">{entry.name}</span>
                      {!loadable && (
                        <span className="compare-picker-recent-reason">{reason}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
