/**
 * TransitionEditor Component
 *
 * Form-based controls for managing transitions:
 * - Add transition form (from, to, symbol dropdowns)
 * - List of existing transitions with delete buttons
 */

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Automaton } from '../../engine/types';
import { createDefaultLabel } from '../../ui-state/types';

type TransitionEditorProp = {
  automaton: Automaton;
  onAddTransition: (from: number, to: number, symbol: string) => string | null;
  onRemoveTransition: (from: number, to: number, symbol: string | null) => void;
};

export function TransitionEditor({
  automaton,
  onAddTransition,
  onRemoveTransition,
}: TransitionEditorProp) {
  const sortedStates = Array.from(automaton.states).sort((a, b) => a - b);
  const sortedAlphabet = Array.from(automaton.alphabet).sort();

  const [fromState, setFromState] = useState<number>(sortedStates[0] ?? 0);
  const [toState, setToState] = useState<number>(sortedStates[0] ?? 0);
  const [symbol, setSymbol] = useState<string>(sortedAlphabet[0] ?? '');

  function handleAdd() {
    if (sortedAlphabet.length === 0) return;
    onAddTransition(fromState, toState, symbol);
  }

  // Sort transitions for stable display: by source state, then by symbol
  const sortedTransitions = [...automaton.transitions].sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    const symA = a.symbol ?? '';
    const symB = b.symbol ?? '';
    return symA.localeCompare(symB);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <span className="label">Transitions</span>

      {sortedAlphabet.length === 0 ? (
        <p className="caption">Add symbols to the alphabet in Config first.</p>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
            <select
              className="editor-select"
              value={fromState}
              onChange={(event) => setFromState(Number(event.target.value))}
              aria-label="From state"
              style={{ flex: 1 }}
            >
              {sortedStates.map((id) => (
                <option key={id} value={id}>
                  {createDefaultLabel(id)}
                </option>
              ))}
            </select>

            <span className="caption" aria-hidden="true">→</span>

            <select
              className="editor-select"
              value={toState}
              onChange={(event) => setToState(Number(event.target.value))}
              aria-label="To state"
              style={{ flex: 1 }}
            >
              {sortedStates.map((id) => (
                <option key={id} value={id}>
                  {createDefaultLabel(id)}
                </option>
              ))}
            </select>

            <select
              className="editor-select"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              aria-label="Symbol"
              style={{ width: '56px' }}
            >
              {sortedAlphabet.map((character) => (
                <option key={character} value={character}>
                  {character}
                </option>
              ))}
            </select>

            <button
              className="btn"
              onClick={handleAdd}
              style={{ padding: 'var(--space-1) var(--space-2)' }}
              aria-label="Add transition"
              title="Add transition"
            >
              <Plus size={14} />
            </button>
          </div>
        </>
      )}

      <div className="editor-list">
        {sortedTransitions.map((transition, index) => {
          const destinations = Array.from(transition.to).sort((a, b) => a - b);
          const symbolDisplay = transition.symbol === null ? 'ε' : transition.symbol;
          // For DFA transitions, there is exactly one destination
          const destinationLabel = destinations.map(createDefaultLabel).join(', ');
          return (
            <div key={`${transition.from}-${symbolDisplay}-${index}`} className="editor-row">
              <span className="editor-row-label" style={{ fontSize: 'var(--text-sm)' }}>
                {createDefaultLabel(transition.from)} →{' '}
                <span style={{ color: 'var(--blue-600)' }}>{symbolDisplay}</span> →{' '}
                {destinationLabel}
              </span>
              <button
                className="editor-row-action danger"
                onClick={() =>
                  onRemoveTransition(transition.from, destinations[0]!, transition.symbol)
                }
                aria-label="Delete transition"
                title="Delete transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
        {sortedTransitions.length === 0 && (
          <p className="caption">No transitions yet.</p>
        )}
      </div>
    </div>
  );
}
