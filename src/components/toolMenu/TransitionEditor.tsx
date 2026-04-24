/**
 * TransitionEditor Component
 *
 * Owns the state machine for editing transitions:
 *   - rovingFocus  → which cell currently holds tabIndex=0
 *   - openCell     → which cell's popover is open (at most one at a time)
 *
 * Delegates layout entirely to TransitionGrid (sticky headers + fade
 * overlays). Each cell delegates its trigger + popover to TransitionCell.
 *
 * Keyboard navigation contract:
 *   - Navigation mode (popover closed)  → arrow keys move between cells
 *   - Edit mode      (popover open)     → arrow keys move between options
 *   - Only Enter / Space transitions navigation → edit
 *   - Escape cancels edit and returns to navigation
 */

import { useEffect, useState } from 'react';
import { Automaton } from '../../engine/types';
import { TransitionGrid, EMPTY_VALUE } from './TransitionGrid';

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

  const [rovingFocus, setRovingFocus] = useState<{ row: number; col: number }>({
    row: 0,
    col: 0,
  });
  const [shouldRefocus, setShouldRefocus] = useState(false);
  const [openCell, setOpenCell] = useState<{ row: number; col: number } | null>(null);

  // Snap roving focus inside bounds when source data shrinks (state/alphabet
  // deletion).
  useEffect(() => {
    setRovingFocus((current) => ({
      row: Math.min(current.row, Math.max(0, sortedStates.length - 1)),
      col: Math.min(current.col, Math.max(0, sortedAlphabet.length - 1)),
    }));
  }, [sortedStates.length, sortedAlphabet.length]);

  // After arrow-key navigation, focus the new cell's trigger. Cells are now
  // CSS-grid items in row-major order, so the linear index = row*cols + col.
  useEffect(() => {
    if (!shouldRefocus) return;
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      '.transition-grid-data .transition-grid-cell .transition-grid-trigger'
    );
    const linear = rovingFocus.row * sortedAlphabet.length + rovingFocus.col;
    buttons[linear]?.focus();
    setShouldRefocus(false);
  }, [shouldRefocus, rovingFocus, sortedAlphabet.length]);

  function labelFor(stateId: number): string {
    return displayLabels.get(stateId) ?? `q${stateId}`;
  }

  function destinationOf(from: number, symbol: string): number | null {
    const transition = automaton.transitions.find(
      (t) => t.from === from && t.symbol === symbol
    );
    if (!transition) return null;
    return Array.from(transition.to)[0] ?? null;
  }

  function handleArrowNavigate(event: React.KeyboardEvent) {
    // While a popover is open, the cell owns arrow keys (option list
    // navigation). Don't intercept here.
    if (openCell !== null) return;

    const { key } = event;
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') {
      return;
    }
    const numRows = sortedStates.length;
    const numCols = sortedAlphabet.length;
    if (numRows === 0 || numCols === 0) return;

    let { row, col } = rovingFocus;
    // Clamp at edges (no wraparound) — pressing ArrowRight at the last
    // column does nothing instead of jumping to the first column.
    if (key === 'ArrowUp') row = Math.max(0, row - 1);
    else if (key === 'ArrowDown') row = Math.min(numRows - 1, row + 1);
    else if (key === 'ArrowLeft') col = Math.max(0, col - 1);
    else if (key === 'ArrowRight') col = Math.min(numCols - 1, col + 1);

    event.preventDefault();
    setRovingFocus({ row, col });
    setShouldRefocus(true);
  }

  function handleCellChange(from: number, symbol: string, newValue: string) {
    if (newValue === EMPTY_VALUE) {
      onSetTransition(from, symbol, null);
    } else {
      onSetTransition(from, symbol, Number(newValue));
    }
  }

  // Pre-compute options for every cell (shared, by reference).
  const stateOptions = sortedStates.map((stateId) => ({
    value: String(stateId),
    label: labelFor(stateId),
  }));
  const cellOptions = [{ value: EMPTY_VALUE, label: '—' }, ...stateOptions];

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
      <TransitionGrid
        rowIds={sortedStates}
        columnSymbols={sortedAlphabet}
        rowLabel={labelFor}
        cellOptions={cellOptions}
        rovingFocus={rovingFocus}
        openCell={openCell}
        cellAt={(rowIndex, colIndex) => {
          const from = sortedStates[rowIndex]!;
          const symbol = sortedAlphabet[colIndex]!;
          const destination = destinationOf(from, symbol);
          const value = destination === null ? EMPTY_VALUE : String(destination);
          const isHighlighted =
            highlightedTransition !== null &&
            highlightedTransition.from === from &&
            highlightedTransition.symbol === symbol &&
            destination === highlightedTransition.to;
          return {
            value,
            isMissing: destination === null,
            isHighlighted,
            ariaLabel: `Transition from ${labelFor(from)} on '${symbol}'`,
            onChange: (newValue) => handleCellChange(from, symbol, newValue),
          };
        }}
        onCellFocus={(row, col) => setRovingFocus({ row, col })}
        onOpenChange={(row, col, open) =>
          setOpenCell(open ? { row, col } : null)
        }
        onArrowNavigate={handleArrowNavigate}
      />
    </div>
  );
}
