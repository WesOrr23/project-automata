# Project Automata - Quick Reference

## Running Commands

```bash
# Development
npm run dev          # Start dev server (for UI in Iteration 2+)
npm run build        # Build for production
npm test             # Run tests in watch mode
npm test -- --run    # Run tests once

# Demo
npx tsx src/engine/demo.ts    # Run automaton engine demo
```

---

## Using the Engine

### Import Everything
```typescript
import {
  // Types
  Automaton, Transition, SimulationResult,

  // CRUD operations
  createAutomaton, addState, addTransition,
  setStartState, addAcceptState,

  // Validation
  isDFA, isComplete, isRunnable, getValidationReport,

  // Simulation
  run, accepts, getExecutionTrace
} from './engine';
```

---

## Common Patterns

### 1. Create a DFA

```typescript
// Initialize
let dfa = createAutomaton('DFA', ['0', '1']);

// Add states
dfa = addState(dfa, 'q0');
dfa = addState(dfa, 'q1');
dfa = addState(dfa, 'q2');

// Set start state
dfa = setStartState(dfa, 'q0');

// Mark accept states
dfa = addAcceptState(dfa, 'q2');

// Add transitions
dfa = addTransition(dfa, 'q0', 'q1', '0');
dfa = addTransition(dfa, 'q0', 'q0', '1');
dfa = addTransition(dfa, 'q1', 'q2', '1');
dfa = addTransition(dfa, 'q1', 'q1', '0');
dfa = addTransition(dfa, 'q2', 'q0', '1');
dfa = addTransition(dfa, 'q2', 'q1', '0');
```

### 2. Validate a DFA

```typescript
// Quick check
if (isRunnable(dfa)) {
  console.log('Ready to simulate!');
}

// Detailed report
const report = getValidationReport(dfa);
console.log('Valid:', report.valid);
console.log('Errors:', report.errors);
console.log('Warnings:', report.warnings);
```

### 3. Test Inputs

```typescript
// Simple boolean check
if (accepts(dfa, '101')) {
  console.log('Accepted!');
}

// Full simulation with trace
const result = run(dfa, '101');
console.log('Accepted:', result.accepted);
console.log('Steps:', result.steps);

// Human-readable trace
const trace = getExecutionTrace(result);
trace.forEach(line => console.log(line));
// Output:
// Start: q0 | Remaining: "101"
// Read '1': q0 → q0 | Remaining: "01"
// Read '0': q0 → q1 | Remaining: "1"
// Read '1': q1 → q2 | Remaining: ""
// Result: ACCEPTED
```

### 4. Batch Testing

```typescript
const testCases = [
  { input: '01', expected: true },
  { input: '10', expected: false },
  { input: '', expected: false },
];

testCases.forEach(({ input, expected }) => {
  const result = accepts(dfa, input);
  const pass = result === expected ? '✓' : '✗';
  console.log(`${pass} "${input}" → ${result ? 'ACCEPT' : 'REJECT'}`);
});
```

---

## Error Handling

All operations throw errors for invalid inputs:

```typescript
try {
  dfa = addState(dfa, 'q0');  // Already exists
} catch (error) {
  console.error(error.message);  // "State 'q0' already exists"
}

try {
  dfa = addTransition(dfa, 'q0', 'q99', '0');  // q99 doesn't exist
} catch (error) {
  console.error(error.message);  // "Destination state 'q99' does not exist"
}

try {
  run(incompleteDFA, '101');  // Missing transitions
} catch (error) {
  console.error(error.message);  // "Automaton is not runnable"
}
```

---

## Immutability Pattern

**IMPORTANT**: All operations return NEW automatons. Never mutate!

```typescript
// ✓ GOOD: Chain operations
let dfa = createAutomaton('DFA', ['0', '1']);
dfa = addState(dfa, 'q0');
dfa = addState(dfa, 'q1');
dfa = setStartState(dfa, 'q0');

// ✓ GOOD: Keep old versions
const dfa1 = addState(dfa, 'q2');
const dfa2 = addState(dfa, 'q3');
// dfa1 and dfa2 are different automatons

// ✗ BAD: Don't mutate directly
dfa.states.add('q0');  // Won't work, violates immutability
```

---

## Querying Automatons

```typescript
// Get all transitions from a state
const transitions = getTransitionsFrom(dfa, 'q0');

// Get specific transition
const trans = getTransition(dfa, 'q0', '1');

// Check properties
console.log('Is DFA?', isDFA(dfa));
console.log('Is complete?', isComplete(dfa));
console.log('Has start state?', hasStartState(dfa));
console.log('Has accept states?', hasAcceptStates(dfa));

// Find unreachable states
const orphans = getOrphanedStates(dfa);
if (orphans.size > 0) {
  console.log('Unreachable:', [...orphans]);
}
```

---

## Testing Your Own DFAs

Create a test file:

```typescript
import { describe, it, expect } from 'vitest';
import { createAutomaton, addState, accepts } from '../engine';

describe('My Custom DFA', () => {
  it('accepts correct inputs', () => {
    let dfa = createAutomaton('DFA', ['0', '1']);
    // ... build your DFA ...

    expect(accepts(dfa, '101')).toBe(true);
    expect(accepts(dfa, '110')).toBe(false);
  });
});
```

Run with: `npm test`

---

## File Structure Reference

```
/src/engine/
  ├── types.ts         - Type definitions (import types from here)
  ├── automaton.ts     - CRUD operations
  ├── validator.ts     - Validation functions
  ├── simulator.ts     - Execution engine
  └── index.ts         - Public API (import everything from here)
```

**Best practice**: Always import from `./engine` (the index), not individual files.

---

## Next Steps

- **Iteration 1** (Complete): Engine foundation ✅
- **Iteration 2** (Next): Visualize DFAs with React + SVG
- **Iteration 3**: Interactive simulation
- **Iteration 4**: Manual editing
- **Iteration 5**: NFA support

See `ITERATION1_COMPLETE.md` for full details.
