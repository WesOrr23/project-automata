import { useState, useEffect } from 'react';
import { createAutomaton, addState, addTransition, addAcceptState } from './engine/automaton';
import { Automaton } from './engine/types';
import { AutomatonUI } from './ui-state/types';
import { AutomatonCanvas } from './components/AutomatonCanvas';
import { computeLayout } from './ui-state/utils';

/**
 * Build the sample DFA that accepts binary strings ending in "01"
 * States: q0 (start), q1 (saw 0), q2 (saw "01" - accept)
 */
function buildSampleDFA(): Automaton {
  let dfa = createAutomaton('DFA', new Set(['0', '1']));

  let state1: number;
  ({ automaton: dfa, stateId: state1 } = addState(dfa));

  let state2: number;
  ({ automaton: dfa, stateId: state2 } = addState(dfa));

  dfa = addAcceptState(dfa, state2);

  // From q0 (start):
  dfa = addTransition(dfa, 0, new Set([state1]), '0');
  dfa = addTransition(dfa, 0, new Set([0]), '1');

  // From q1 (saw '0'):
  dfa = addTransition(dfa, state1, new Set([state1]), '0');
  dfa = addTransition(dfa, state1, new Set([state2]), '1');

  // From q2 (accept - saw "01"):
  dfa = addTransition(dfa, state2, new Set([state1]), '0');
  dfa = addTransition(dfa, state2, new Set([0]), '1');

  return dfa;
}

function App() {
  const [dfa] = useState<Automaton>(() => buildSampleDFA());
  const [automatonUI, setAutomatonUI] = useState<AutomatonUI | null>(null);

  useEffect(() => {
    computeLayout(dfa).then(setAutomatonUI);
  }, [dfa]);

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Project Automata</h1>
      <p>Iteration 3: Advanced Visualization</p>
      <p style={{ fontSize: '14px', color: '#666' }}>
        DFA accepting binary strings ending in "01" (auto-layout)
      </p>

      {automatonUI === null ? (
        <p>Loading layout...</p>
      ) : (
        <AutomatonCanvas automaton={dfa} automatonUI={automatonUI} />
      )}
    </div>
  );
}

export default App
