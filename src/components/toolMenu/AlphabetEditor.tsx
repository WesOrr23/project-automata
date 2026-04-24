/**
 * AlphabetEditor Component
 *
 * Manages the automaton's input alphabet: shows current symbols as
 * removable badges, provides an input + Add button for new symbols.
 * Errors and paste-truncation warnings are routed to the global
 * notification system via useNotifications().
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import { useNotifications } from '../../notifications/useNotifications';

type AlphabetEditorProp = {
  alphabet: Set<string>;
  highlightedSymbol: string | null;
  onAlphabetAdd: (symbol: string) => void;
  onAlphabetRemove: (symbol: string) => void;
};

export function AlphabetEditor({
  alphabet,
  highlightedSymbol,
  onAlphabetAdd,
  onAlphabetRemove,
}: AlphabetEditorProp) {
  const [draftSymbol, setDraftSymbol] = useState('');
  const { notify } = useNotifications();

  function handleAdd() {
    const symbol = draftSymbol.trim();
    if (symbol.length === 0) {
      notify({ severity: 'error', title: 'Symbol cannot be empty' });
      return;
    }
    if (symbol.length > 1) {
      notify({
        severity: 'error',
        title: 'Symbols must be a single character',
        detail: `You entered "${symbol}" (${symbol.length} characters).`,
      });
      return;
    }
    if (alphabet.has(symbol)) {
      notify({
        severity: 'error',
        title: `'${symbol}' is already in the alphabet`,
        target: { kind: 'alphabet', symbol },
      });
      return;
    }
    onAlphabetAdd(symbol);
    setDraftSymbol('');
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') handleAdd();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text');
    if (pasted.length > 1) {
      notify({
        severity: 'warning',
        title: `Pasted content truncated`,
        detail: `Only the first character ('${pasted[0]}') will be used; symbols are one character each.`,
      });
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
          <span
            key={symbol}
            className={`alphabet-badge ${symbol === highlightedSymbol ? 'pulse-error' : ''}`}
          >
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
          onChange={(event) => setDraftSymbol(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="New symbol"
          maxLength={1}
          style={{ flex: 1 }}
          aria-label="New alphabet symbol (one character)"
        />
        <button className="btn" onClick={handleAdd}>
          Add
        </button>
      </div>
    </div>
  );
}
