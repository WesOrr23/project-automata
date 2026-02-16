import { createAutomaton, addState, addTransition, addAcceptState } from './engine/automaton';
import { AutomatonCanvas } from './components/AutomatonCanvas';
import { AutomatonUI, createDefaultLabel } from './ui-state/types';

function App() {
  // Create a DFA that accepts binary strings ending in "01"
  // States: q0 (start), q1 (saw 0), q2 (saw "01" - accept)

  // Step 1: Create automaton with initial state 0
  let dfa = createAutomaton('DFA', new Set(['0', '1']));

  // Step 2: Add two more states
  let state1: number;
  ({ automaton: dfa, stateId: state1 } = addState(dfa));

  let state2: number;
  ({ automaton: dfa, stateId: state2 } = addState(dfa));

  // Step 3: Set state 2 as accept state
  dfa = addAcceptState(dfa, state2);

  // Step 4: Add transitions
  // From q0 (start):
  dfa = addTransition(dfa, 0, new Set([state1]), '0');  // '0' → q1
  dfa = addTransition(dfa, 0, new Set([0]), '1');       // '1' → q0 (stay)

  // From q1 (saw '0'):
  dfa = addTransition(dfa, state1, new Set([state1]), '0');    // '0' → q1 (stay, waiting for 1)
  dfa = addTransition(dfa, state1, new Set([state2]), '1');    // '1' → q2 (accept!)

  // From q2 (accept - saw "01"):
  dfa = addTransition(dfa, state2, new Set([state1]), '0');    // '0' → q1 (start new "01" sequence)
  dfa = addTransition(dfa, state2, new Set([0]), '1');         // '1' → q0 (reset)

  // Step 5: Create UI metadata with positions
  // Triangle layout to avoid arrow overlap issues
  const automatonUI: AutomatonUI = {
    states: new Map([
      [0, { id: 0, position: { x: 200, y: 300 }, label: createDefaultLabel(0) }],
      [state1, { id: state1, position: { x: 450, y: 300 }, label: createDefaultLabel(state1) }],
      [state2, { id: state2, position: { x: 600, y: 300 }, label: createDefaultLabel(state2) }],
    ]),
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Project Automata</h1>
      <p>Iteration 2: Basic Visualization</p>
      <p style={{ fontSize: '14px', color: '#666' }}>
        DFA accepting binary strings ending in "01"
      </p>

      <AutomatonCanvas automaton={dfa} automatonUI={automatonUI} />
    </div>
  );
}

export default App
