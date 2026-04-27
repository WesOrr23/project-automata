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
import { X, Upload, Download, Play } from 'lucide-react';
import { Automaton } from '../engine/types';
import { accepts } from '../engine/simulator';

type BatchTestModalProp = {
  open: boolean;
  onClose: () => void;
  automaton: Automaton;
};

type ResultRow = {
  input: string;
  status: 'accept' | 'reject' | 'error';
  detail?: string;
};

export function BatchTestModal({ open, onClose, automaton }: BatchTestModalProp) {
  const [inputsText, setInputsText] = useState('');
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Esc to dismiss + focus the close button on open so keyboard
  // navigation has a sensible starting point.
  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    closeButtonRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

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

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="batch-test-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="batch-test-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-test-title"
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
            disabled={inputsText.trim().length === 0}
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
              <span className="batch-test-summary-accept">
                {acceptCount} accepted
              </span>
              <span className="batch-test-summary-reject">
                {rejectCount} rejected
              </span>
              {errorCount > 0 && (
                <span className="batch-test-summary-error">
                  {errorCount} error{errorCount === 1 ? '' : 's'}
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
                        {row.status === 'accept' && '✓ accept'}
                        {row.status === 'reject' && '✗ reject'}
                        {row.status === 'error' && `⚠ ${row.detail ?? 'error'}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
