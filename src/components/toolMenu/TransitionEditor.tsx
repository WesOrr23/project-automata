/**
 * TransitionEditor Component
 *
 * Renders the automaton's transition function as a table:
 *   - rows: source states
 *   - columns: alphabet symbols
 *   - cells: destination state (or empty for missing transition)
 *
 * Each cell is a dropdown over the available destination states. The empty
 * option ('—') means "no transition" and removing a transition is just
 * picking '—' for that cell. Adding/replacing a transition is picking any
 * other destination.
 *
 * Empty cells therefore *are* the missing transitions — no separate
 * "ghost transitions" UI needed.
 */

import { Automaton } from '../../engine/types';

type TransitionEditorProp = {
  automaton: Automaton;
  displayLabels: Map<number, string>;
  highlightedTransition: { from: number; to: number; symbol: string | null } | null;
  onSetTransition: (from: number, symbol: string, to: number | null) => void;
};

const EMPTY_VALUE = '__none__';

export function TransitionEditor({
  automaton,
  displayLabels,
  highlightedTransition,
  onSetTransition,
}: TransitionEditorProp) {
  const sortedStates = Array.from(automaton.states).sort((a, b) => a - b);
  const sortedAlphabet = Array.from(automaton.alphabet).sort();

  function labelFor(stateId: number): string {
    return displayLabels.get(stateId) ?? `q${stateId}`;
  }

  /** Find the destination of the (from, symbol) transition, or null. */
  function destinationOf(from: number, symbol: string): number | null {
    const t = automaton.transitions.find(
      (transition) => transition.from === from && transition.symbol === symbol
    );
    if (!t) return null;
    const first = Array.from(t.to)[0];
    return first ?? null;
  }

  function handleCellChange(from: number, symbol: string, newValue: string) {
    if (newValue === EMPTY_VALUE) {
      onSetTransition(from, symbol, null);
    } else {
      onSetTransition(from, symbol, Number(newValue));
    }
  }

  // Empty alphabet → table has no columns; render a hint instead.
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
        <table className="transition-table">
          <thead>
            <tr>
              <th aria-label="Source state column header" />
              {sortedAlphabet.map((symbol) => (
                <th key={symbol} className="transition-table-symbol">
                  {symbol}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedStates.map((from) => (
              <tr key={from}>
                <th scope="row" className="transition-table-source">
                  {labelFor(from)}
                </th>
                {sortedAlphabet.map((symbol) => {
                  const destination = destinationOf(from, symbol);
                  const value = destination === null ? EMPTY_VALUE : String(destination);
                  const isHighlighted =
                    highlightedTransition !== null &&
                    highlightedTransition.from === from &&
                    highlightedTransition.symbol === symbol &&
                    (destination === highlightedTransition.to);
                  const isMissing = destination === null;
                  return (
                    <td
                      key={symbol}
                      className={[
                        'transition-table-cell',
                        isMissing ? 'transition-table-cell-missing' : '',
                        isHighlighted ? 'pulse-error' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <select
                        className="transition-table-select"
                        value={value}
                        onChange={(event) =>
                          handleCellChange(from, symbol, event.target.value)
                        }
                        aria-label={`Transition from ${labelFor(from)} on '${symbol}'`}
                      >
                        <option value={EMPTY_VALUE}>—</option>
                        {sortedStates.map((target) => (
                          <option key={target} value={target}>
                            {labelFor(target)}
                          </option>
                        ))}
                      </select>
                    </td>
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
