/**
 * ConfigPanel Component
 *
 * App-level configuration for the automaton:
 * - Automaton type selector (DFA / NFA)
 * - Export to JSON
 *
 * Note: alphabet editing lives in the Edit tab (see AlphabetEditor) because
 * alphabet is part of building the automaton, not a settings-level choice.
 */

type ConfigPanelProp = {
  automatonType: 'DFA' | 'NFA';
  onTypeChange: (type: 'DFA' | 'NFA') => void;
  onExportJSON?: () => void;
};

export function ConfigPanel({
  automatonType,
  onTypeChange,
  onExportJSON,
}: ConfigPanelProp) {
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
            disabled
            title="NFA support coming later"
          >
            NFA
          </button>
        </div>
      </div>

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
