import { StateNode } from './components/StateNode';

function App() {
  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h1>Project Automata</h1>
      <p>Iteration 2: Testing StateNode Component</p>

      <svg
        width="800"
        height="600"
        style={{ border: '1px solid #ccc', marginTop: '20px' }}
      >
        {/* Test 1: Regular state */}
        <StateNode
          stateId={0}
          label="q0"
          x={150}
          y={300}
          isStart={false}
          isAccept={false}
        />

        {/* Test 2: Accept state (double circle) */}
        <StateNode
          stateId={1}
          label="q1"
          x={400}
          y={300}
          isStart={false}
          isAccept={true}
        />

        {/* Test 3: Another regular state */}
        <StateNode
          stateId={2}
          label="q2"
          x={650}
          y={300}
          isStart={false}
          isAccept={false}
        />
      </svg>
    </div>
  );
}

export default App
