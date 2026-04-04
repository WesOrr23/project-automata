import { useState, useEffect } from 'react';
import { createAutomaton, addState, addTransition, addAcceptState } from './engine/automaton';
import { Automaton } from './engine/types';
import { AutomatonUI } from './ui-state/types';
import { AutomatonCanvas } from './components/AutomatonCanvas';
import { InputPanel } from './components/InputPanel';
import { SimulationControls } from './components/SimulationControls';
import { computeLayout } from './ui-state/utils';
import { useSimulation } from './hooks/useSimulation';

/**
 * Build the sample DFA that accepts binary strings ending in "01"
 */
function buildSampleDFA(): Automaton {
  let dfa = createAutomaton('DFA', new Set(['0', '1']));

  let state1: number;
  ({ automaton: dfa, stateId: state1 } = addState(dfa));

  let state2: number;
  ({ automaton: dfa, stateId: state2 } = addState(dfa));

  dfa = addAcceptState(dfa, state2);

  dfa = addTransition(dfa, 0, new Set([state1]), '0');
  dfa = addTransition(dfa, 0, new Set([0]), '1');
  dfa = addTransition(dfa, state1, new Set([state1]), '0');
  dfa = addTransition(dfa, state1, new Set([state2]), '1');
  dfa = addTransition(dfa, state2, new Set([state1]), '0');
  dfa = addTransition(dfa, state2, new Set([0]), '1');

  return dfa;
}

function App() {
  const [dfa] = useState<Automaton>(() => buildSampleDFA());
  const [automatonUI, setAutomatonUI] = useState<AutomatonUI | null>(null);
  const [inputString, setInputString] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const sim = useSimulation(dfa);

  useEffect(() => {
    computeLayout(dfa).then(setAutomatonUI);
  }, [dfa]);

  /**
   * Handle input changes — always allowed.
   * If a simulation is active, auto-reset it when input changes.
   */
  function handleInputChange(value: string) {
    if (sim.simulation !== null) {
      sim.reset();
    }
    setInputString(value);
  }

  /**
   * Ensure simulation is initialized before stepping/playing.
   * Re-initializes if finished (for replay).
   */
  function ensureInitialized(): boolean {
    if (inputString.length === 0) return false;
    if (sim.simulation === null || sim.status === 'finished') {
      sim.initialize(inputString);
    }
    return true;
  }

  function handleStep() {
    if (sim.simulation === null || sim.status === 'finished') {
      if (!ensureInitialized()) return;
      return;
    }
    sim.stepForward();
  }

  function handlePlay() {
    if (sim.simulation === null || sim.status === 'finished') {
      if (!ensureInitialized()) return;
    }
    sim.run();
  }

  /**
   * Handle clicking a consumed character to jump to that history position.
   * Character at index N was consumed by the transition from step N to step N+1,
   * so clicking it jumps to step N (the state before that character was consumed).
   */
  function handleJumpTo(characterIndex: number) {
    if (inputString.length === 0) return;
    sim.jumpTo(characterIndex, inputString);
  }

  const resultStatus: 'accepted' | 'rejected' | null =
    sim.status === 'finished' && sim.accepted !== null
      ? (sim.accepted ? 'accepted' : 'rejected')
      : null;

  return (
    <>
      {/* Sidebar toggle — visible when collapsed */}
      <button
        className={`sidebar-toggle ${sidebarCollapsed ? '' : 'hidden'}`}
        onClick={() => setSidebarCollapsed(false)}
        aria-label="Open controls"
      >
        ›
      </button>

      {/* Floating sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="label">Simulate</span>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="Close controls"
            style={{
              position: 'static',
              width: 'var(--space-5)',
              height: 'var(--space-5)',
              fontSize: 'var(--text-sm)',
            }}
          >
            ‹
          </button>
        </div>

        <div className="divider" />

        <InputPanel
          alphabet={dfa.alphabet}
          input={inputString}
          onInputChange={handleInputChange}
        />

        <SimulationControls
          status={sim.status}
          hasSimulation={sim.simulation !== null}
          hasInput={inputString.length > 0}
          accepted={sim.accepted}
          speed={sim.speed}
          input={inputString}
          consumedCount={sim.consumedCount}
          onStep={handleStep}
          onPlay={handlePlay}
          onPause={sim.pause}
          onStepBack={sim.stepBack}
          canStepBack={sim.canStepBack}
          onSpeedChange={sim.setSpeed}
          onJumpTo={handleJumpTo}
        />
      </aside>

      {/* Full viewport canvas */}
      <main className="canvas-area">
        {automatonUI === null ? (
          <p className="caption">Loading...</p>
        ) : (
          <AutomatonCanvas
            automaton={dfa}
            automatonUI={automatonUI}
            activeStateIds={sim.currentStateIds}
            resultStatus={resultStatus}
            nextTransition={sim.nextTransition}
          />
        )}
      </main>
    </>
  );
}

export default App
