/**
 * Demo script showing the automaton engine in action
 * Run with: npx tsx src/engine/demo.ts
 *
 * This demo creates a DFA that accepts all strings that
 * begin OR end (or both) with "01"
 */

import {
  createAutomaton,
  addState,
  addTransition,
  addAcceptState,
  runSimulation,
  isAccepted,
  getValidationReport,
} from './index';

console.log('=== DFA: Strings that begin OR end (or both) with "01" ===\n');

// Create DFA with alphabet {0, 1}
let dfa = createAutomaton('DFA', new Set(['0', '1']));
// State 0 = A (start state, auto-created)

// Add states B, C, D, E, F
const { automaton: dfa1, stateId: B } = addState(dfa); // B = 1
const { automaton: dfa2, stateId: C } = addState(dfa1); // C = 2
const { automaton: dfa3, stateId: D } = addState(dfa2); // D = 3
const { automaton: dfa4, stateId: E } = addState(dfa3); // E = 4
const { automaton: dfa5, stateId: F } = addState(dfa4); // F = 5

const A = 0; // A is state 0 (auto-created)

console.log('✓ Created DFA with alphabet {0, 1}');
console.log(`✓ Added states: A=${A}, B=${B}, C=${C}, D=${D}, E=${E}, F=${F}`);
console.log('  State A is automatically the start state\n');

// Set accept states: D and F
dfa = addAcceptState(dfa5, D);
dfa = addAcceptState(dfa, F);
console.log(`✓ Set accept states: D=${D}, F=${F}\n`);

// Add all transitions
console.log('Adding transitions...');

// From A
dfa = addTransition(dfa, A, new Set([B]), '0');
dfa = addTransition(dfa, A, new Set([C]), '1');

// From B
dfa = addTransition(dfa, B, new Set([E]), '0');
dfa = addTransition(dfa, B, new Set([D]), '1');

// From C
dfa = addTransition(dfa, C, new Set([E]), '0');
dfa = addTransition(dfa, C, new Set([C]), '1');

// From D (trap accept state - once here, always accept)
dfa = addTransition(dfa, D, new Set([D]), '0');
dfa = addTransition(dfa, D, new Set([D]), '1');

// From E
dfa = addTransition(dfa, E, new Set([E]), '0');
dfa = addTransition(dfa, E, new Set([F]), '1');

// From F
dfa = addTransition(dfa, F, new Set([E]), '0');
dfa = addTransition(dfa, F, new Set([C]), '1');

console.log('✓ Added 12 transitions');
console.log('  A --0--> B   A --1--> C');
console.log('  B --0--> E   B --1--> D');
console.log('  C --0--> E   C --1--> C');
console.log('  D --0--> D   D --1--> D  (trap accept)');
console.log('  E --0--> E   E --1--> F');
console.log('  F --0--> E   F --1--> C');

// Validate the DFA
console.log('\n=== Validation Report ===\n');
const report = getValidationReport(dfa);
console.log('Valid:', report.valid);
console.log('Errors:', report.errors.length > 0 ? report.errors : 'None');
console.log('Warnings:', report.warnings.length > 0 ? report.warnings : 'None');

// State name mapping for output
const stateName = (n: number): string => ['A', 'B', 'C', 'D', 'E', 'F'][n]!;

// Test cases
console.log('\n=== Testing Inputs ===\n');

const quickTests = [
  { input: '01', expected: true, reason: 'begins AND ends with 01' },
  { input: '010', expected: true, reason: 'begins with 01' },
  { input: '001', expected: true, reason: 'ends with 01' },
  { input: '10', expected: false, reason: 'neither begins nor ends with 01' },
  { input: '1101', expected: true, reason: 'ends with 01' },
  { input: '0111', expected: true, reason: 'begins with 01' },
  { input: '00', expected: false, reason: 'neither begins nor ends with 01' },
  { input: '11', expected: false, reason: 'neither begins nor ends with 01' },
];

for (const { input, expected, reason } of quickTests) {
  const result = isAccepted(runSimulation(dfa, input));
  const symbol = result === expected ? '✓' : '✗';
  const status = result ? 'ACCEPT' : 'REJECT';
  console.log(
    `${symbol} "${input}" → ${status} (${reason})`
  );
}

// Show detailed traces for selected examples
console.log('\n=== Detailed Execution Traces ===\n');

const detailedTests = [
  { input: '01', reason: 'begins with 01 (and ends with 01)' },
  { input: '001', reason: 'ends with 01' },
  { input: '1101', reason: 'ends with 01 (but not begins)' },
  { input: '10', reason: 'neither begins nor ends with 01' },
];

for (const { input, reason } of detailedTests) {
  const sim = runSimulation(dfa, input);
  const accepted = isAccepted(sim);

  console.log(`Input: "${input}" (${reason})`);
  console.log('Trace:');

  // Custom trace with state names
  for (let i = 0; i < sim.steps.length; i++) {
    const step = sim.steps[i]!;
    if (step.symbolProcessed === null) {
      console.log(
        `  Start: ${stateName(step.currentState)} | Remaining: "${
          step.remainingInput
        }"`
      );
    } else {
      const prev = sim.steps[i - 1]!.currentState;
      console.log(
        `  Read '${step.symbolProcessed}': ${stateName(prev)} → ${stateName(
          step.currentState
        )} | Remaining: "${step.remainingInput}"`
      );
    }
  }

  const finalState = sim.steps[sim.steps.length - 1]!.currentState;
  console.log(
    `  Final state: ${stateName(finalState)} → ${
      accepted ? 'ACCEPTED' : 'REJECTED'
    }`
  );
  console.log();
}

console.log('=== Demo Complete! ===');
console.log('\nKey takeaways:');
console.log('- createAutomaton() creates state 0 as the start state');
console.log('- State IDs are auto-generated integers (0, 1, 2...)');
console.log('- Alphabet is a Set (automatic uniqueness)');
console.log('- Transitions use Sets for destinations');
console.log('- For DFA: new Set([destination]) - always single element');
console.log('- State D is a "trap accept" - once reached, always accepts');
console.log('- Complex DFA logic can be expressed clearly');
