/**
 * ConfigPanel Component
 *
 * Renders configuration controls for the automaton:
 * - Automaton type toggle (DFA / NFA)
 * - Alphabet editor (add/remove symbols)
 * - Export to JSON (wired in Phase 5)
 */

import { useState } from 'react';
import { X } from 'lucide-react';

type ConfigPanelProp = {
  automatonType: 'DFA' | 'NFA';
  alphabet: Set<string>;
  onTypeChange: (type: 'DFA' | 'NFA') => void;
  onAlphabetAdd: (symbol: string) => void;
  onAlphabetRemove: (symbol: string) => void;
  onExportJSON?: () => void;
};

export function ConfigPanel({
  automatonType,
  alphabet,
  onTypeChange,
  onAlphabetAdd,
  onAlphabetRemove,
  onExportJSON,
}: ConfigPanelProp) {
  const [draftSymbol, setDraftSymbol] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const symbol = draftSymbol.trim();
    if (symbol.length === 0) {
      setError('Symbol cannot be empty');
      return;
    }
    if (symbol.length > 1) {
      setError('Symbols must be a single character');
      return;
    }
    if (alphabet.has(symbol)) {
      setError(`'${symbol}' is already in the alphabet`);
      return;
    }
    onAlphabetAdd(symbol);
    setDraftSymbol('');
    setError(null);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') handleAdd();
  }

  const sortedAlphabet = Array.from(alphabet).sort();
  const canRemove = alphabet.size > 1;

  return (
    <>
      {/* Automaton type toggle */}
      <div>
        <span className="label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          Type
        </span>
        <div className="speed-toggle">
          <button
            className={`speed-toggle-option ${automatonType === 'DFA' ? 'active' : ''}`}
            onClick={() => onTypeChange('DFA')}
          >
            DFA
          </button>
          <button
            className={`speed-toggle-option ${automatonType === 'NFA' ? 'active' : ''}`}
            onClick={() => onTypeChange('NFA')}
            disabled
            title="NFA support coming later"
          >
            NFA
          </button>
        </div>
      </div>

      {/* Alphabet editor */}
      <div>
        <span className="label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          Alphabet
        </span>

        <div className="alphabet-badges">
          {sortedAlphabet.map((symbol) => (
            <span key={symbol} className="alphabet-badge">
              <span className="alphabet-badge-symbol">{symbol}</span>
              <button
                className="alphabet-badge-remove"
                onClick={() => onAlphabetRemove(symbol)}
                disabled={!canRemove}
                aria-label={`Remove symbol ${symbol}`}
                title={canRemove ? `Remove '${symbol}'` : 'Alphabet must have at least one symbol'}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
          <input
            type="text"
            className="glass-input"
            value={draftSymbol}
            onChange={(event) => {
              setDraftSymbol(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            placeholder="New symbol"
            maxLength={1}
            style={{ flex: 1 }}
          />
          <button className="btn" onClick={handleAdd}>
            Add
          </button>
        </div>

        {error && (
          <p className="caption" style={{ color: 'var(--error-text)', marginTop: 'var(--space-2)' }}>
            {error}
          </p>
        )}
      </div>

      {/* Export */}
      {onExportJSON && (
        <>
          <div className="divider" />
          <button className="btn" onClick={onExportJSON} style={{ width: '100%' }}>
            Export JSON
          </button>
        </>
      )}
    </>
  );
}
