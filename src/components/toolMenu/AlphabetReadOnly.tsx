/**
 * AlphabetReadOnly Component
 *
 * Compact, non-editable view of the alphabet for the Edit panel. The
 * source of truth lives in Define (ConfigPanel + AlphabetEditor); this
 * is just a reminder of what symbols are available while the user is
 * adding transitions, plus a "+" button that jumps the user back to
 * Define with the alphabet input focused.
 *
 * Rationale: alphabet is part of the FA's formal definition (Σ in the
 * tuple), so editing belongs on the Define stage. But discovering "I
 * need a new symbol" usually happens mid-transition-edit — making
 * users tab-hop without breadcrumbs would be a workflow tax. The
 * jump-to button collapses that round-trip into one click.
 */

import { SquarePen } from 'lucide-react';

type AlphabetReadOnlyProp = {
  alphabet: Set<string>;
  highlightedSymbol: string | null;
  /** Switches the menu to Define and focuses the alphabet input.
   *  Action is broader than "add" — the user might also want to
   *  remove a symbol — so the button reads "Edit" rather than "+". */
  onJumpToAlphabet: () => void;
};

export function AlphabetReadOnly({
  alphabet,
  highlightedSymbol,
  onJumpToAlphabet,
}: AlphabetReadOnlyProp) {
  const sortedAlphabet = Array.from(alphabet).sort();

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-2)',
        }}
      >
        <span className="label">Alphabet</span>
        <button
          type="button"
          className="btn"
          onClick={onJumpToAlphabet}
          title="Edit alphabet in Define"
          aria-label="Edit alphabet — jumps to Define"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 10px',
            fontSize: 'var(--text-sm)',
          }}
        >
          <SquarePen size={12} />
          <span>Edit</span>
        </button>
      </div>

      <div className="alphabet-badges">
        {sortedAlphabet.length === 0 ? (
          <span className="caption" style={{ fontStyle: 'italic' }}>
            (empty — add symbols in Define)
          </span>
        ) : (
          sortedAlphabet.map((symbol) => (
            <span
              key={symbol}
              className={`alphabet-badge alphabet-badge-readonly ${symbol === highlightedSymbol ? 'pulse-error' : ''}`}
            >
              <span className="alphabet-badge-symbol">{symbol}</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
