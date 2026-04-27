/**
 * AlphabetEditor Component
 *
 * Manages the automaton's input alphabet: shows current symbols as
 * removable badges, provides an input + Add button for new symbols.
 * Errors and paste-truncation warnings are routed to the global
 * notification system via useNotifications().
 */

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useNotifications } from '../../notifications/useNotifications';

type AlphabetEditorProp = {
  alphabet: Set<string>;
  highlightedSymbol: string | null;
  onAlphabetAdd: (symbol: string) => void;
  onAlphabetRemove: (symbol: string) => void;
  /** Incrementing counter; when it changes the input gets focused.
   *  Used by the "+" jump-to button on the Edit panel's read-only
   *  alphabet strip — switches the menu to Define and hands the user
   *  a focused input so they can immediately type a new symbol. */
  focusSignal?: number;
};

export function AlphabetEditor({
  alphabet,
  highlightedSymbol,
  onAlphabetAdd,
  onAlphabetRemove,
  focusSignal,
}: AlphabetEditorProp) {
  const [draftSymbol, setDraftSymbol] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { notify } = useNotifications();

  useEffect(() => {
    if (focusSignal === undefined) return;
    // Defer one tick so the focus lands after the menu's
    // OPEN-and-show-Define render commits.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [focusSignal]);

  function handleAdd() {
    const symbol = draftSymbol.trim();
    if (symbol.length === 0) {
      notify({
        severity: 'error',
        title: 'Empty symbol',
        detail: 'Enter a single character to add to the alphabet.',
        autoDismissMs: 4_000,
      });
      return;
    }
    if (symbol.length > 1) {
      notify({
        severity: 'error',
        title: 'Symbol too long',
        detail: `You entered "${symbol}" (${symbol.length} characters). Alphabet symbols are one character each.`,
        autoDismissMs: 4_000,
      });
      return;
    }
    if (alphabet.has(symbol)) {
      notify({
        severity: 'error',
        title: 'Duplicate symbol',
        detail: `'${symbol}' is already in the alphabet.`,
        target: { kind: 'alphabet', symbol },
        autoDismissMs: 4_000,
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
        title: 'Paste truncated',
        detail: `Only the first character ('${pasted[0]}') was kept; symbols are one character each.`,
        autoDismissMs: 4_000,
      });
    }
  }

  const sortedAlphabet = Array.from(alphabet).sort();

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
              aria-label={`Remove symbol ${symbol}`}
              title={`Remove '${symbol}'`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
        <input
          ref={inputRef}
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
