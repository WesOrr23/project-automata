# Project Automata

An interactive web-based simulator for deterministic and non-deterministic finite automata (DFA/NFA). Build automata visually, run input strings step-by-step, convert NFA → DFA, minimize, compare, and more.

A learning project — pair-programmed in TypeScript + React, with a strict separation between a pure engine and the React/SVG UI.

## Quick start

```bash
npm install
npm run dev          # dev server (Vite)
npm test             # run vitest
npm run build        # production build (tsc -b && vite build)
```

## What it does today

- **Build** automata interactively — add states, draw transitions, mark start/accept, edit the alphabet
- **Simulate** any input string step-by-step, with the active state(s) highlighted and a per-step transition pulse
- **Operations** — NFA→DFA conversion, minimization, complement, union/intersection/difference, equivalence check
- **Files** — save/load `.automaton.json`, recents list, batch-test input strings via CSV
- **Image export** — PNG snapshot of the current canvas
- **Undo/redo** with ⌘Z / ⌘⇧Z (50-deep snapshot stack)

## Project layout

```
src/
  engine/          Pure TS — no React. Automaton model, simulator, validator, converter, etc.
  ui-state/        UI-only types and helpers (positions, labels, GraphViz layout, image export)
  components/      React + SVG. Canvas, state nodes, edges, popovers, tool menu, modals
  hooks/           Custom React hooks (viewport, simulation, keyboard scopes, undo, file session)
  notifications/   Toast/notification system
  files/           File adapter (load/save/format), recents store
  styles/          CSS — tokens, canvas, tool-menu, popover, simulation, animations, notifications
  data/            Sample automaton JSON
  App.tsx          Composition root
  main.tsx         Entry point

docs/
  iterations/      Per-iteration plan + complete docs (1 → 18)
  brainstorms/     Open-ended design exploration
  reference/       Architecture patterns, config guide, onboarding design, quick reference
  planning/        Future iterations, next-features, handoff notes
  archive/         Historical docs (DEBATE.md etc.)

.claude/
  agents/          Custom Claude Code agents (e.g. ui-architect)
  council/         Persistent reviewer agents (architecture, qa, ts, security, auditor, writer)
                   Each has identity / knowledge / journal / decisions / open-questions.
                   Read `.claude/council/_orchestrator.md` first on any audit-flavored task.
```

## Architectural principles

- **Functional, not class-based** — automata are plain immutable data; operations return new values
- **Engine ↔ UI separation** — `engine/` never imports from React; `ui-state/` and `components/` import from `engine/`
- **Numeric state IDs (engine) + display labels (UI)** — engine owns identity, UI owns presentation
- **Sets for uniqueness, arrays for order** — states/alphabet/accepts use Sets; JSON converts to arrays
- **Result type for fallible engine ops** — discriminated `Result<T>` instead of throwing
- **Strict TypeScript** — `exactOptionalPropertyTypes` on; `omit-or-set`, never `| undefined`

See [`CLAUDE.md`](./CLAUDE.md) for the full development memory and conventions.

## Tech stack

- TypeScript (strict) + React 19
- Vite 6 + Vitest 3
- SVG for rendering, GraphViz WASM (`@hpcc-js/wasm-graphviz`) for layout
- `motion` for transitions, `lucide-react` for icons

## Status

Currently on iteration 17/18 (menu polish, image export, batch testing, undo/redo, onboarding, keyboard-scope stack, in-progress transition previews). See `docs/iterations/` for per-iteration completion notes.

## License

MIT
