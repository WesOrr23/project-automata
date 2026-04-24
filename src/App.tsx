import { useState, useEffect } from 'react';
import { createAutomaton, addState, addTransition, addAcceptState } from './engine/automaton';
import { Automaton } from './engine/types';
import { AutomatonUI } from './ui-state/types';
import { AutomatonCanvas } from './components/AutomatonCanvas';
import { InputPanel } from './components/InputPanel';
import { SimulationControls } from './components/SimulationControls';
import { ToolMenu } from './components/toolMenu/ToolMenu';
import { ToolMenuState, ToolTabID } from './components/toolMenu/types';
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
  const [automaton] = useState<Automaton>(() => buildSampleDFA());
  const [automatonUI, setAutomatonUI] = useState<AutomatonUI | null>(null);
  const [inputString, setInputString] = useState('');
  const [menuState, setMenuState] = useState<ToolMenuState>({ mode: 'COLLAPSED' });

  const sim = useSimulation(automaton);

  useEffect(() => {
    computeLayout(automaton).then(setAutomatonUI);
  }, [automaton]);

  // ─── Menu state transitions ───

  function handleHoverEnter() {
    setMenuState((current) => (current.mode === 'COLLAPSED' ? { mode: 'EXPANDED' } : current));
  }

  function handleHoverLeave() {
    setMenuState((current) => (current.mode === 'EXPANDED' ? { mode: 'COLLAPSED' } : current));
  }

  function handleTabClick(tab: ToolTabID) {
    setMenuState({ mode: 'OPEN', activeTab: tab });
  }

  function handleCollapse() {
    setMenuState({ mode: 'COLLAPSED' });
  }

  // ─── Simulation handlers ───

  function handleInputChange(value: string) {
    if (sim.simulation !== null) {
      sim.reset();
    }
    setInputString(value);
  }

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

  function handleJumpTo(characterIndex: number) {
    if (inputString.length === 0) return;
    sim.jumpTo(characterIndex, inputString);
  }

  const resultStatus: 'accepted' | 'rejected' | null =
    sim.status === 'finished' && sim.accepted !== null
      ? (sim.accepted ? 'accepted' : 'rejected')
      : null;

  // ─── Panel content ───

  const configContent = <p className="caption">Config coming soon.</p>;

  const editContent = <p className="caption">Edit coming soon.</p>;

  const simulateContent = (
    <>
      <InputPanel
        alphabet={automaton.alphabet}
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
    </>
  );

  return (
    <>
      <ToolMenu
        state={menuState}
        onHoverEvent={handleHoverEnter}
        onHoverLeave={handleHoverLeave}
        onTabClick={handleTabClick}
        onCollapse={handleCollapse}
        configContent={configContent}
        editContent={editContent}
        simulateContent={simulateContent}
      />

      <main className="canvas-area">
        {automatonUI === null ? (
          <p className="caption">Loading...</p>
        ) : (
          <AutomatonCanvas
            automaton={automaton}
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
