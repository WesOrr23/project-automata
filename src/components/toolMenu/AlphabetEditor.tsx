/**
 * AlphabetEditor Component
 *
 * Manages the automaton's input alphabet: shows current symbols as
 * removable badges, provides an input + Add button for new symbols.
 * Detects paste events and warns if the pasted content would be truncated.
 */

import { useState } from 'react';
import { X } from 'lucide-react';

type AlphabetEditorProp = {
  alphabet: Set<string>;
  onAlphabetAdd: (symbol: string) => void;
  onAlphabetRemove: (symbol: string) => void;
};

export function AlphabetEditor({
  alphabet,
  onAlphabetAdd,
  onAlphabetRemove,
}: AlphabetEditorProp) {
  const [draftSymbol, setDraftSymbol] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pasteWarning, setPasteWarning] = useState<string | null>(null);

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
    setPasteWarning(null);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') handleAdd();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text');
    if (pasted.length > 1) {
      setPasteWarning(`Pasted content truncated to first character ('${pasted[0]}')`);
    } else {
      setPasteWarning(null);
    }
  }

  const sortedAlphabet = Array.from(alphabet).sort();
  const canRemove = alphabet.size > 1;

  return (
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
          onPaste={handlePaste}
          placeholder="New symbol"
          maxLength={1}
          style={{ flex: 1 }}
          aria-label="New alphabet symbol (one character)"
          aria-describedby="alphabet-hint"
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
      {pasteWarning && !error && (
        <p className="caption" style={{ color: '#b45309', marginTop: 'var(--space-2)' }}>
          {pasteWarning}
        </p>
      )}
    </div>
  );
}
