# Project Automata

An interactive web-based simulator for deterministic and non-deterministic finite automata (DFA/NFA).

## Current Status

**Iteration 2 Complete** - Basic visualization working with static DFA rendering using SVG.

The simulator currently displays DFA states and transitions visually. Interactive simulation and editing features are planned for future iterations.

## Features

- **Pure functional architecture** - Automaton represented as immutable data structures
- **Type-safe engine** - Core logic written in TypeScript with comprehensive validation
- **SVG visualization** - Clean, scalable rendering of states and transitions
- **Separation of concerns** - Engine layer independent of UI, fully testable

## Tech Stack

- **TypeScript** - Type safety and better developer experience
- **React** - UI components and state management
- **SVG** - Visual automata representation
- **Vite** - Fast development and build tooling
- **Vitest** - Unit testing framework

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### Building for Production

```bash
npm run build
```

## Project Structure

```
/src
  /engine                    # Pure TypeScript logic (no React dependencies)
    - types.ts               # Core type definitions
    - automaton.ts           # CRUD operations for automata
    - simulator.ts           # Execution and simulation logic
    - validator.ts           # DFA/NFA validation predicates

  /components                # React + SVG visualization
    - AutomatonCanvas.tsx    # Main SVG container
    - StateNode.tsx          # Individual state rendering
    - TransitionEdge.tsx     # Transition arrows
    - StartStateArrow.tsx    # Start state indicator

  /ui-state                  # UI-specific types and logic
    - types.ts               # Visual metadata (positions, labels)
```

## Development Approach

This project is built using an agile, iterative approach:

- **Iteration 1**: Engine foundation (DFA logic) ✅
- **Iteration 2**: Basic visualization (static rendering) ✅
- **Iteration 3**: Advanced visualization (auto-layout, self-loops) - In Progress
- **Iteration 4**: Interactive simulation (step-by-step execution)
- **Future**: Manual editing, NFA support, file management, advanced features

See `CLAUDE.md` for detailed development documentation.

## Architecture Principles

- **Functional approach** - Plain objects with pure functions (no classes)
- **Immutability** - All operations return new automata rather than mutating
- **Engine/UI separation** - Engine is framework-agnostic, UI layer handles React/SVG
- **Type safety** - Leverages TypeScript for correctness and maintainability

## Contributing

This is a learning project, but suggestions and feedback are welcome! Please open an issue to discuss potential changes.

## License

MIT
