/**
 * TransitionEditor Component
 *
 * Renders the automaton's transition function as a table:
 *   - rows: source states
 *   - columns: alphabet symbols
 *   - cells: destination state (or empty for missing transition)
 *
 * Each cell uses a custom dropdown (TransitionCell) with controlled popup
 * positioning, arrow-key navigation, and Escape-to-close — replacing the
 * native <select> whose popup overlapped neighbouring cells uncontrollably.
 *
 * Keyboard navigation across cells uses the "roving tabindex" pattern: only
 * one cell at a time has tabIndex=0, and arrow keys move that focus around
 * the grid. Tab into the table lands on the rovingly-focused cell; from
 * there, arrows move; Enter opens the cell's dropdown.
 */

import { useEffect, useState } from 'react';
import { Automaton } from '../../engine/types';
import { TransitionCell } from './TransitionCell';

const EMPTY_VALUE = '__none__';

type TransitionEditorProp = {
  automaton: Automaton;
  displayLabels: Map<number, string>;
  highlightedTransition: { from: number; to: number; symbol: string | null } | null;
  onSetTransition: (from: number, symbol: string, to: number | null) => void;
};

export function TransitionEditor({
  automaton,
  displayLabels,
  highlightedTransition,
  onSetTransition,
}: TransitionEditorProp) {
  const sortedStates = Array.from(automaton.states).sort((a, b) => a - b);
  const sortedAlphabet = Array.from(automaton.alphabet).sort();

  // Roving focus position. Coords are (rowIndex, colIndex). When the user
  // presses arrow keys on a focused cell, we update this and (after render)
  // focus the new cell.
  const [rovingFocus, setRovingFocus] = useState<{ row: number; col: number }>({
    row: 0,
    col: 0,
  });
  const [shouldRefocus, setShouldRefocus] = useState(false);

  // Which cell's popover is currently open. At most one at a time, by design.
  // Lifted up here (rather than per-cell internal state) so opening one cell
  // implicitly closes any other.
  const [openCell, setOpenCell] = useState<{ row: number; col: number } | null>(null);

  // Snap the roving focus to a valid position whenever the underlying data
  // changes (e.g. user deleted the focused state).
  useEffect(() => {
    setRovingFocus((current) => ({
      row: Math.min(current.row, Math.max(0, sortedStates.length - 1)),
      col: Math.min(current.col, Math.max(0, sortedAlphabet.length - 1)),
    }));
  }, [sortedStates.length, sortedAlphabet.length]);

  // After arrow-key navigation, programmatically focus the new cell's
  // trigger button. Done via a flag + effect so we don't need refs to every
  // cell.
  useEffect(() => {
    if (!shouldRefocus) return;
    const selector = `.transition-table tbody tr:nth-child(${rovingFocus.row + 1}) td:nth-child(${rovingFocus.col + 2}) button`;
    const target = document.querySelector<HTMLButtonElement>(selector);
    target?.focus();
    setShouldRefocus(false);
  }, [shouldRefocus, rovingFocus]);

  function labelFor(stateId: number): string {
    return displayLabels.get(stateId) ?? `q${stateId}`;
  }

  function destinationOf(from: number, symbol: string): number | null {
    const t = automaton.transitions.find(
      (transition) => transition.from === from && transition.symbol === symbol
    );
    if (!t) return null;
    return Array.from(t.to)[0] ?? null;
  }

  function handleCellChange(from: number, symbol: string, newValue: string) {
    if (newValue === EMPTY_VALUE) {
      onSetTransition(from, symbol, null);
    } else {
      onSetTransition(from, symbol, Number(newValue));
    }
  }

  function handleTableKeyDown(event: React.KeyboardEvent<HTMLTableElement>) {
    // When a popover is open, the cell IS the keyboard focus owner —
    // arrow keys belong to the popover (navigating its options). The
    // table-level handler must stay out of the way until the user dismisses
    // the popover with Escape or commits with Enter.
    if (openCell !== null) return;

    // Navigation mode: arrows move the roving focus between cells.
    const { key } = event;
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') {
      return;
    }
    const numRows = sortedStates.length;
    const numCols = sortedAlphabet.length;
    if (numRows === 0 || numCols === 0) return;

    let { row, col } = rovingFocus;
    if (key === 'ArrowUp') row = (row - 1 + numRows) % numRows;
    else if (key === 'ArrowDown') row = (row + 1) % numRows;
    else if (key === 'ArrowLeft') col = (col - 1 + numCols) % numCols;
    else if (key === 'ArrowRight') col = (col + 1) % numCols;

    event.preventDefault();
    setRovingFocus({ row, col });
    setShouldRefocus(true);
  }

  // Build the option list once per render; passed by reference into each
  // cell. Includes the empty option at the top.
  const stateOptions = sortedStates.map((stateId) => ({
    value: String(stateId),
    label: labelFor(stateId),
  }));
  const optionsWithEmpty = [{ value: EMPTY_VALUE, label: '—' }, ...stateOptions];

  if (sortedAlphabet.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <span className="label">Transitions</span>
        <p className="caption">Add symbols to the alphabet above first.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span className="label">Transitions</span>

      <div className="transition-table-wrap">
        <table
          className="transition-table"
          onKeyDown={handleTableKeyDown}
          role="grid"
        >
          <thead>
            <tr>
              <th aria-label="Source state column header" />
              {sortedAlphabet.map((symbol) => (
                <th key={symbol} className="transition-table-symbol" scope="col">
                  {symbol}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStates.map((from, rowIndex) => (
              <tr key={from}>
                <th scope="row" className="transition-table-source">
                  {labelFor(from)}
                </th>
                {sortedAlphabet.map((symbol, colIndex) => {
                  const destination = destinationOf(from, symbol);
                  const value = destination === null ? EMPTY_VALUE : String(destination);
                  const isHighlighted =
                    highlightedTransition !== null &&
                    highlightedTransition.from === from &&
                    highlightedTransition.symbol === symbol &&
                    destination === highlightedTransition.to;
                  const isRovingFocused =
                    rovingFocus.row === rowIndex && rovingFocus.col === colIndex;
                  const isOpen =
                    openCell !== null &&
                    openCell.row === rowIndex &&
                    openCell.col === colIndex;
                  return (
                    <TransitionCell
                      key={symbol}
                      value={value}
                      options={optionsWithEmpty}
                      isMissing={destination === null}
                      isHighlighted={isHighlighted}
                      ariaLabel={`Transition from ${labelFor(from)} on '${symbol}'`}
                      isRovingFocused={isRovingFocused}
                      isOpen={isOpen}
                      onChange={(newValue) => handleCellChange(from, symbol, newValue)}
                      onFocus={() => setRovingFocus({ row: rowIndex, col: colIndex })}
                      onOpenChange={(open) =>
                        setOpenCell(open ? { row: rowIndex, col: colIndex } : null)
                      }
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
