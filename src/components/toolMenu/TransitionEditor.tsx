/**
 * TransitionEditor Component
 *
 * Form-based controls for managing transitions:
 * - Add transition form (from, to, symbol dropdowns)
 * - Inline error banner (right next to the form, not buried below the list)
 * - List of existing transitions with delete buttons
 */

import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Automaton } from '../../engine/types';

type TransitionEditorProp = {
  automaton: Automaton;
  displayLabels: Map<number, string>;
  error: string | null;
  onAddTransition: (from: number, to: number, symbol: string) => string | null;
  onRemoveTransition: (from: number, to: number, symbol: string | null) => void;
  onDismissError: () => void;
};

export function TransitionEditor({
  automaton,
  displayLabels,
  error,
  onAddTransition,
  onRemoveTransition,
  onDismissError,
}: TransitionEditorProp) {
  const sortedStates = Array.from(automaton.states).sort((a, b) => a - b);
  const sortedAlphabet = Array.from(automaton.alphabet).sort();

  const [fromState, setFromState] = useState<number>(sortedStates[0] ?? 0);
  const [toState, setToState] = useState<number>(sortedStates[0] ?? 0);
  const [symbol, setSymbol] = useState<string>(sortedAlphabet[0] ?? '');

  function labelFor(stateId: number): string {
    return displayLabels.get(stateId) ?? `q${stateId}`;
  }

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
        <p className="caption">Add symbols to the alphabet above first.</p>
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
                  {labelFor(id)}
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
                  {labelFor(id)}
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

          {/* Error appears inline right after the form, not buried at the bottom */}
          {error && (
            <div
              className="editor-validation-banner"
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ flex: 1 }}>{error}</span>
              <button
                className="editor-row-action"
                onClick={onDismissError}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onDismissError();
                  }
                }}
                aria-label="Dismiss error"
                title="Dismiss"
                style={{ border: 'none', background: 'transparent', color: 'inherit' }}
              >
                <X size={14} />
              </button>
            </div>
          )}
        </>
      )}

      <div className="editor-list">
        {sortedTransitions.map((transition, index) => {
          const destinations = Array.from(transition.to).sort((a, b) => a - b);
          const symbolDisplay = transition.symbol === null ? 'ε' : transition.symbol;
          const destinationLabel = destinations.map(labelFor).join(', ');
          const firstDestination = destinations[0];
          return (
            <div
              key={`${transition.from}-${symbolDisplay}-${index}`}
              className="editor-row show-actions-on-hover"
            >
              <span className="editor-row-label" style={{ fontSize: 'var(--text-sm)' }}>
                {labelFor(transition.from)} →{' '}
                <span style={{ color: 'var(--blue-600)' }}>{symbolDisplay}</span> →{' '}
                {destinationLabel}
              </span>
              <button
                className="editor-row-action danger hide-unless-hover"
                onClick={() => {
                  if (firstDestination !== undefined) {
                    onRemoveTransition(transition.from, firstDestination, transition.symbol);
                  }
                }}
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
