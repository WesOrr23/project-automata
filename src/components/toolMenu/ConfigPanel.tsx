/**
 * ConfigPanel Component (renders the "Define" tab)
 *
 * Stage-1 surface in the workflow ladder. Holds the FA's *declarative*
 * fields — the parts of the formal definition that aren't constructed
 * interactively in Edit:
 *   - Automaton type (DFA / NFA)
 *   - Reserved ε-symbol (NFA mode only)
 *   - Free-form description / notes
 *   - Clear canvas (escape hatch)
 *   - Export to JSON
 *
 * Alphabet currently lives in Edit (Phase C of the Define refactor will
 * move it back here once the read-only badge + jump-to-Define shortcut
 * lands in Edit).
 */

import { useEffect, useState } from 'react';

type ConfigPanelProp = {
  automatonType: 'DFA' | 'NFA';
  onTypeChange: (type: 'DFA' | 'NFA') => void;
  /** The single character that means "ε" in the transition symbol input. */
  epsilonSymbol: string;
  /** Validation: returns null if accepted, an error message otherwise. */
  onEpsilonSymbolChange: (newSymbol: string) => string | null;
  /** Free-form description / notes. Persisted in the save file's metadata. */
  description: string;
  onDescriptionChange: (next: string) => void;
  /** Reset the automaton to a single state with the current alphabet preserved. */
  onClearCanvas: () => void;
  onExportJSON?: () => void;
};

export function ConfigPanel({
  automatonType,
  onTypeChange,
  epsilonSymbol,
  onEpsilonSymbolChange,
  description,
  onDescriptionChange,
  onClearCanvas,
  onExportJSON,
}: ConfigPanelProp) {
  // Local draft so the user can clear the field while typing without
  // immediately tripping validation. The committed value still lives in
  // App state via onEpsilonSymbolChange.
  const [draft, setDraft] = useState(epsilonSymbol);
  const [error, setError] = useState<string | null>(null);

  // Resync draft if the parent's value changes externally (e.g. JSON
  // load). Comparing against the prop avoids fighting the user's input.
  useEffect(() => {
    setDraft(epsilonSymbol);
  }, [epsilonSymbol]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setDraft(value);
    if (value === '') {
      setError(null);
      return;
    }
    if (value.length !== 1) {
      setError('Use a single character');
      return;
    }
    const validationError = onEpsilonSymbolChange(value);
    setError(validationError);
  }

  return (
    <>
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
          >
            NFA
          </button>
        </div>
      </div>

      {automatonType === 'NFA' && (
        <div>
          {/* Keep the .label class's uppercase styling for "SYMBOL", but
            * exempt the Greek lowercase ε so it doesn't render as "E". */}
          <span
            className="label"
            style={{ display: 'block', marginBottom: 'var(--space-2)' }}
          >
            <span style={{ textTransform: 'none' }}>ε</span> symbol
          </span>
          <input
            type="text"
            className={`glass-input ${error !== null ? 'invalid' : ''}`}
            value={draft}
            onChange={handleChange}
            maxLength={1}
            style={{ width: '60px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}
            aria-label="Reserved epsilon symbol"
          />
          <p className="caption" style={{ marginTop: 'var(--space-1)' }}>
            {error ??
              `Type '${epsilonSymbol}' as a transition symbol to author an ε-transition. This character is forbidden in the alphabet.`}
          </p>
        </div>
      )}

      <div>
        <span className="label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
          Description
        </span>
        <textarea
          className="glass-input"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="What does this FA recognize? Any caveats?"
          rows={3}
          style={{
            width: '100%',
            resize: 'vertical',
            minHeight: '60px',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            lineHeight: 1.4,
          }}
          aria-label="Automaton description"
        />
        <p className="caption" style={{ marginTop: 'var(--space-1)' }}>
          Free-form notes. Saved with the file.
        </p>
      </div>

      <div className="divider" />
      <button
        className="btn btn-danger"
        onClick={onClearCanvas}
        style={{ width: '100%' }}
        title="Reset the canvas: one state, no transitions. Alphabet and type are kept."
      >
        Clear canvas
      </button>

      {onExportJSON && (
        <button className="btn" onClick={onExportJSON} style={{ width: '100%' }}>
          Export JSON
        </button>
      )}
    </>
  );
}
