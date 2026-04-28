/**
 * BatchTestModal Component
 *
 * Modal for running many input strings against the current automaton at
 * once. Two input paths: paste/type into a textarea (one input per
 * line), or import a CSV (one input per row, first column).
 *
 * Results render as a compact table: input | accepted ✓/✗ | optional
 * error reason. After a run the user can export the results back out
 * as CSV for sharing or grading.
 *
 * Stage placement: opens from a small "Test batch" button next to the
 * single-input field in the Simulate panel. The single-input field
 * stays for the animated step-through case; this modal is the
 * "I want to run 30 strings and see a table" companion.
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Upload, Download, Play, ArrowRightFromLine } from 'lucide-react';
import { Automaton } from '../engine/types';
import { accepts } from '../engine/simulator';
import { useKeyboardScope } from '../hooks/useKeyboardScope';

type BatchTestModalProp = {
  open: boolean;
  onClose: () => void;
  automaton: Automaton;
  /** Called when the user clicks the "load this input" affordance on
   *  a result row. App should set the single-input field to `input`,
   *  close the modal, and focus the simulation Play button so the
   *  user can immediately run the animated step-through. */
  onLoadInput?: (input: string) => void;
};

type ResultRow = {
  input: string;
  status: 'accept' | 'reject' | 'error';
  detail?: string;
};

export function BatchTestModal({ open, onClose, automaton, onLoadInput }: BatchTestModalProp) {
  const [inputsText, setInputsText] = useState('');
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Focus the close button on open so keyboard navigation has a
  // sensible starting point.
  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
  }, [open]);

  // Esc dismisses. Capture-true since this is a modal — Esc should
  // close THIS modal first, not bubble down to the CommandBar
  // popover-Esc or anything else on the stack.
  useKeyboardScope({
    id: 'batch-test-modal-esc',
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
    // Click outside the modal card dismisses; clicks inside don't.
    if (event.target === overlayRef.current) onClose();
  }

  function parseInputs(): string[] {
    // One input per line, trimmed. Blank lines preserved as the
    // empty-string input (often a meaningful test for accept-empty
    // automata) only if the user wrote them deliberately as a single
    // empty line — leading/trailing blank lines are dropped.
    const lines = inputsText.split(/\r?\n/);
    // Trim leading and trailing all-blank lines, preserve internal.
    let start = 0;
    let end = lines.length;
    while (start < end && lines[start]?.trim() === '') start++;
    while (end > start && lines[end - 1]?.trim() === '') end--;
    return lines.slice(start, end);
  }

  function runAll() {
    const inputs = parseInputs();
    const rows: ResultRow[] = inputs.map((input) => {
      const result = accepts(automaton, input);
      if (!result.ok) {
        return { input, status: 'error', detail: result.error };
      }
      return { input, status: result.value ? 'accept' : 'reject' };
    });
    setResults(rows);
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      // Naive CSV: take the FIRST column of every non-empty row, strip
      // surrounding quotes. Good enough for the "one input per row"
      // common case; users with quoted commas in inputs can still use
      // the textarea path.
      const inputs = text
        .split(/\r?\n/)
        .map((line) => line.split(',')[0] ?? '')
        .map((cell) => cell.trim().replace(/^"(.*)"$/, '$1'))
        .filter((cell) => cell.length > 0 || /,/.test(text)); // keep blanks only if CSV uses commas
      setInputsText(inputs.join('\n'));
      // Reset the file input so re-picking the same file fires onchange.
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  }

  function handleExportResults() {
    if (!results) return;
    // CSV escape: quote any cell with a comma, quote, or newline;
    // double-up internal quotes.
    const escape = (cell: string) => {
      if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
      return cell;
    };
    const header = 'input,result\n';
    const body = results
      .map((row) => `${escape(row.input)},${row.status}`)
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'batch-results.csv';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  const acceptCount = results?.filter((r) => r.status === 'accept').length ?? 0;
  const rejectCount = results?.filter((r) => r.status === 'reject').length ?? 0;
  const errorCount = results?.filter((r) => r.status === 'error').length ?? 0;

  return (
    // AnimatePresence wraps the conditional render so opening fades
    // the dim layer + scales-in the card; closing reverses both. The
    // earlier `if (!open) return null` ran before any render, so the
    // modal popped in instantly — wrapping in AnimatePresence with
    // the gate INSIDE lets exit animations actually play.
    <AnimatePresence>
      {open && (
    <motion.div
      ref={overlayRef}
      className="batch-test-overlay"
      onClick={handleOverlayClick}
      role="presentation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
    >
      <motion.div
        className="batch-test-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-test-title"
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.15 } }}
        transition={{ duration: 0.22, ease: [0.34, 1.2, 0.64, 1] }}
      >
        <div className="batch-test-header">
          <h2 id="batch-test-title" className="batch-test-title">
            Batch test
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="batch-test-close"
            onClick={onClose}
            aria-label="Close batch test"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        <p className="batch-test-hint">
          One input per line. Or import a CSV (first column = input).
        </p>

        <textarea
          className="batch-test-textarea glass-input"
          value={inputsText}
          onChange={(event) => setInputsText(event.target.value)}
          placeholder="0110&#10;1011&#10;empty line above for ε"
          rows={6}
          aria-label="Input strings — one per line"
        />

        <div className="batch-test-actions">
          <button
            type="button"
            className="btn"
            onClick={handleImportClick}
            title="Import inputs from a CSV file"
          >
            <Upload size={14} />
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={runAll}
          >
            <Play size={14} />
            <span>Run all</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {results && (
          <div className="batch-test-results">
            <div className="batch-test-summary">
              <span>
                <span className="batch-test-count-accept">{acceptCount}</span>
                <span> accepted</span>
              </span>
              <span>
                <span className="batch-test-count-reject">{rejectCount}</span>
                <span> rejected</span>
              </span>
              {errorCount > 0 && (
                <span>
                  <span className="batch-test-count-error">{errorCount}</span>
                  <span> error{errorCount === 1 ? '' : 's'}</span>
                </span>
              )}
              <button
                type="button"
                className="btn batch-test-export"
                onClick={handleExportResults}
                title="Save results as CSV"
              >
                <Download size={12} />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="batch-test-table-wrap">
              <table className="batch-test-table">
                <thead>
                  <tr>
                    <th>Input</th>
                    <th>Result</th>
                    {onLoadInput && <th aria-label="Load this input"></th>}
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, index) => (
                    <tr key={index} className={`batch-test-row-${row.status}`}>
                      <td className="batch-test-input-cell">
                        {row.input.length === 0 ? (
                          <span className="batch-test-empty-label">(ε empty)</span>
                        ) : (
                          row.input
                        )}
                      </td>
                      <td className="batch-test-result-cell">
                        {row.status === 'accept' && (
                          <>
                            <span className="batch-test-marker batch-test-marker-accept">✓</span>
                            <span> accept</span>
                          </>
                        )}
                        {row.status === 'reject' && (
                          <>
                            <span className="batch-test-marker batch-test-marker-reject">✗</span>
                            <span> reject</span>
                          </>
                        )}
                        {row.status === 'error' && (
                          <>
                            <span className="batch-test-marker batch-test-marker-error">⚠</span>
                            <span> {row.detail ?? 'error'}</span>
                          </>
                        )}
                      </td>
                      {onLoadInput && (
                        <td className="batch-test-action-cell">
                          {/* Load this input into the single-input
                              field, close the modal, focus Play.
                              Same row-action vocabulary as the trash
                              icon in the State editor — small ghost
                              button on hover. Disabled on error rows
                              because the single-input field would
                              filter out the invalid characters before
                              the user could even see what was loaded. */}
                          <button
                            type="button"
                            className="batch-test-row-load"
                            onClick={() => onLoadInput(row.input)}
                            disabled={row.status === 'error'}
                            title={
                              row.status === 'error'
                                ? 'Cannot load — this input has symbols outside the alphabet'
                                : 'Load this input into the simulator'
                            }
                            aria-label={`Load "${row.input || '(empty)'}" into the simulator`}
                          >
                            <ArrowRightFromLine size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
