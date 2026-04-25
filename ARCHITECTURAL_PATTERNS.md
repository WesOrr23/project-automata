# Architectural Patterns

A living reference of the cross-cutting design decisions that shape this codebase. This is the "why" file — mechanics are in each iteration's ARCHITECTURE.md, but the patterns that show up across files and iterations are here.

Read this to build the mental scaffolding that makes individual files feel obvious. Each entry follows the same structure: **the rule → the rationale → where to find it → common mistakes.**

Updated through iteration 5.

---

## 1. Two-domain architecture: engine vs UI

**The rule.** All automaton logic lives in `src/engine/*`. All React, CSS, DOM concerns live everywhere else. Engine never imports from UI; UI freely imports from engine.

**Why.**
- Testability — engine is pure TypeScript, runs in Node under Vitest without a DOM.
- Swap-ability — you could replace the entire UI (CLI, mobile, different framework) without touching engine code.
- Reasoning — when investigating a bug, you know whether it's a logic issue (engine) or a presentation issue (UI).

**Where.**
- `src/engine/` — types, automaton CRUD, validation, simulation. Zero React.
- `src/components/`, `src/hooks/`, `src/ui-state/`, `src/App.tsx` — React land.

**Mistakes to avoid.**
- Engine functions returning JSX or className strings.
- UI code storing visual metadata (positions, labels) on the `Automaton` type itself.
- Validation logic duplicated between engine and UI.

---

## 2. Immutability: engine functions return new objects

**The rule.** Every engine function that "modifies" an automaton returns a **new** Automaton. The input is never mutated.

```typescript
const newAutomaton = addState(automaton).automaton;
// automaton is unchanged
```

**Why.**
- Plays directly with React — `setAutomaton(newAutomaton)` triggers re-renders because the reference changed.
- Trivial rollback / undo — you still have the old reference if you kept it.
- No "spooky action at a distance" — a function taking an automaton can't secretly change the caller's copy.
- JSON serialization stays simple (no prototype chains, no mutable internals).

**Where.**
- `src/engine/automaton.ts` — every function.
- `setAutomaton` always called with a fresh object from an engine call or a spread.

**Mistakes to avoid.**
- `automaton.states.add(3)` — mutates in place. Invisible to React, won't re-render.
- `{...prev, states: prev.states.add(3)}` — same trap: the spread is shallow; `states` is a Set that gets mutated.
- Correct pattern: `{...prev, states: new Set([...prev.states, 3])}`.

---

## 3. Identity lives in the engine; labels live in the UI

**The rule.** The engine refers to states by **numeric IDs** (0, 1, 2, …). Display strings like `"q0"` are computed in the UI layer, never stored in the engine.

**Why.**
- One source of truth for identity. Renaming a state visually (future feature) doesn't touch engine logic.
- Serialization stable — JSON always uses the numeric ID.
- Prevents a whole class of bugs where "the label" and "the real name" drift.

**Where.**
- `src/engine/types.ts` — `states: Set<number>`.
- `src/ui-state/types.ts` — `createDefaultLabel(stateId)` returns `"q${stateId}"`.

**Mistakes to avoid.**
- Engine functions accepting string labels like `'q0'`. (Iteration 1 considered this and rejected it.)
- UI code using numeric IDs in user-facing text without mapping through `createDefaultLabel`.

---

## 4. Sets for uniqueness; arrays for order & JSON

**The rule.**
- Use `Set<T>` in engine types for anything with uniqueness semantics (states, alphabet, transition destinations, accept states).
- Use arrays only when order matters (simulation history, transition list for rendering) or when crossing JSON boundaries.

**Why.**
- Structural correctness — `Set` literally can't hold duplicates. No runtime checks needed.
- Semantic clarity — `Set<number>` tells the reader "these are distinct," `number[]` doesn't.
- Cost: JSON doesn't serialize Sets, so import/export does a Set↔Array conversion.

**Where.**
- `src/engine/types.ts` — `states: Set<number>`, `alphabet: Set<string>`, etc.
- `handleExportJSON` in App.tsx — `Array.from(automaton.states).sort(...)` on every Set field.

**Mistakes to avoid.**
- Using `string[]` for alphabet and manually deduplicating.
- Serializing a Set with `JSON.stringify` — produces `{}` silently.

---

## 5. Lifted state: lowest common ancestor rule

**The rule.** React state lives at the lowest component that needs it. If only one component uses it, it's local (`useState` inside that component). If two or more do, it's lifted to the nearest common parent.

**Why.**
- Minimizes prop threading.
- Single source of truth — two components can't disagree about state that's shared.
- Keeps reusable components reusable — they don't depend on "the app" existing.

**Where.**
- `draftSymbol` in `ConfigPanel` — only ConfigPanel cares about what the user has typed so far.
- `automaton` in `App.tsx` — ToolMenu, AutomatonCanvas, and every editor need it.
- `fromState`/`toState`/`symbol` dropdown values in `TransitionEditor` — only the editor cares.

**Mistakes to avoid.**
- Putting "what the user is typing right now" in global/lifted state — causes parent re-renders on every keystroke.
- Putting the actual saved alphabet in local state — other components can't read it.

---

## 6. Make illegal states unrepresentable

**The rule.** Design types so invalid combinations can't be constructed. Discriminated unions are the main tool.

**Why.**
- If the compiler refuses to build it, you never need a runtime check.
- Fewer defensive `if` statements, cleaner logic.
- Bugs move from runtime to compile time.

**Where.**
- `ToolMenuState` (iter 5) — only the `OPEN` variant has `activeTab`, because that's the only state where it has meaning.
- `Transition` — symbol is `string | null`, where `null` means ε-transition. The type encodes a semantic distinction.

**Mistakes to avoid.**
- `{ mode: '...', activeTab?: string }` — encodes two independent optional fields that should be correlated.
- Runtime "I hope this is consistent" checks that a better type would eliminate.

---

## 7. Controlled inputs: React owns the value

**The rule.** Form inputs use `value={...}` and `onChange={...}`. React state is the source of truth; the DOM just displays it.

**Why.**
- `setValue('')` actually clears the field.
- Validation, transformation, normalization all happen in one place (the setter or handler).
- No sync bugs between "what the user sees" and "what we process."

**Where.**
- `InputPanel` — simulation input, with per-keystroke alphabet filtering.
- `ConfigPanel` — new-symbol input, cleared on Add.
- `TransitionEditor` — the three `<select>` dropdowns.

**Mistakes to avoid.**
- Leaving off `value={...}` ("uncontrolled") — field can't be programmatically cleared or normalized.
- Using `defaultValue` when you meant `value`. `defaultValue` is for uncontrolled inputs' initial state.

---

## 8. Reducer pattern for complex state machines

**The rule.** When state has many fields that change together under strict transition rules, use `useReducer` with a pure reducer function. Keeps logic centralized and directly testable.

**Why.**
- One function describes every valid transition.
- Testable without React — call `reducer(state, action)` directly.
- Protects against "update A but forget to update B" bugs.

**Where.**
- `useSimulation` (iter 4) — history, historyIndex, status, speed all move together.
- `useSimulation.test.ts` — 33 tests exercise the reducer as pure data.

**Mistakes to avoid.**
- Splitting correlated state across multiple `useState` calls — updates aren't atomic.
- Reducer with side effects (timers, fetches) — breaks testability. Effects go in the hook around the reducer.

---

## 9. Async layout: debounce + version guard

**The rule.** Any async computation driven by rapidly-changing state needs two protections:
1. **Debounce** — don't fire on every change; wait for a quiet window.
2. **Version guard** — if a stale response arrives after a fresh one, discard it.

**Why.**
- Without debounce: you spawn a request per keystroke. Server/CPU meltdown.
- Without version guard: async responses can arrive out of order. A stale result clobbers a fresh one — the UI flickers or shows wrong data.

**Where.**
- `App.tsx` → the `computeLayout` effect. Debounced 120ms; `layoutVersionRef` ensures only the latest version's promise commits.

**Mistakes to avoid.**
- Debounce alone — doesn't protect against a slow older call beating a fast newer one.
- Version guard alone — still hammers the layout engine on every keystroke.

---

## 10. Validation gating: non-destructive editing

**The rule.** The user can build incomplete or invalid structures. Don't block the edits — instead, gate the *downstream action* (simulation) on validity.

**Why.**
- Prevents frustrating "you can't do X because Y isn't set yet" dialogs mid-edit.
- Encourages exploration — users try things, see errors, iterate.
- Separates "can I construct this?" (always yes, within structural invariants) from "is this ready to run?" (only sometimes).

**Where.**
- `isRunnable(automaton)` + `getValidationReport(automaton)` in `src/engine/validator.ts`.
- `Simulate` tab in App.tsx renders `ValidationView` instead of playback controls when not runnable.
- `addTransition` throws on impossibility (from/to don't exist, symbol not in alphabet) — but never on "not ready to simulate."

**Mistakes to avoid.**
- Disabling the "add state" button because the automaton isn't complete — restrictive, bad UX.
- Letting the user click "Simulate" and crashing because the automaton is invalid — confusing.

---

## 11. Presentational vs container components

**The rule.** Most components should be **dumb**: receive props, render, call callbacks. One component near the top (App.tsx) is **smart**: owns state, dispatches events to handlers, composes everything.

**Why.**
- Dumb components are reusable and testable.
- Smart components are inherently app-specific; limit them to the top.
- Easier to find where "the logic" lives.

**Where.**
- Smart: `App.tsx`, `useSimulation` hook.
- Dumb: every component in `src/components/` including the whole `toolMenu/` tree.

**Mistakes to avoid.**
- A leaf component reaching out to global state or calling engine functions directly.
- A "dumb" component with 10 useState calls that actually contains business logic.

---

## 12. Composition over inheritance: content as ReactNode props

**The rule.** When a parent renders variable content based on child type, don't subclass or switch on type inside the parent. Let the caller pass pre-built JSX as a prop.

**Why.**
- Avoids prop drilling — ConfigPanel/EditPanel/SimulatePanel all need different data, but ToolMenu doesn't have to know.
- Each panel component has strongly-typed props specific to its needs.
- The parent (ToolMenu) stays ignorant of the children's internals.

**Where.**
- `ToolMenu` accepts `configContent`, `editContent`, `simulateContent` as `ReactNode`.
- `App.tsx` constructs each panel with its specific props, hands them to ToolMenu.

**Mistakes to avoid.**
- Making ToolMenu accept a flat bag of props for all three panels and dispatching internally.
- Using actual inheritance (`class EditPanel extends BasePanel`) — React doesn't want you to.

---

## 13. Cascade semantics live at the right layer

**The rule.** Data relationships that are structural belong in the engine (enforced by every CRUD function). Relationships that are conventional or UX-driven belong in the App-level handlers.

**Why.**
- Engine stays minimal — only enforces what's definitionally true.
- App layer can define richer "intuitive" behaviors without polluting the core.

**Where.**
- `removeState` in engine: also removes transitions involving that state. This is structural — a transition referring to a non-existent state is *ill-formed*.
- `handleAlphabetRemove` in App.tsx: cascades removal to transitions using that symbol. This is UX-driven — the engine would accept transitions with "orphan" symbols; the app decides that's undesirable.

**Mistakes to avoid.**
- Putting UX cascades in the engine — forces anyone embedding the engine into a different UI to inherit App's product decisions.
- Omitting structural cascades — lets callers build malformed automata.

---

## 14. Derive locally, lift sources

**The rule.** If a value can be computed from other values, compute it where you need it rather than storing or passing it.

**Why.**
- One source of truth for the rule that produces the derived value.
- No sync bugs between the source and the cache.
- Easier refactoring — change the rule in one place.

**Where.**
- `canDelete = states.size > 1` in `StateEditor`.
- `sortedIds = Array.from(states).sort(...)` — same idea.
- `appMode` derived from `menuState` in App.tsx.

**Mistakes to avoid.**
- Adding `isComplete` to the Automaton type — now you have to keep it synced with every edit.
- Passing `isStartState` as a prop to every `<StateNode>` — it can be derived from `states`/`startState`.

---

## 15. Exhaustive switches with `never`

**The rule.** When switching on a union type where every case should be handled, use a `default` branch that assigns to `const _: never = value;`. Forces TypeScript to error if anyone adds a new union member without handling it.

**Why.**
- Catches the "oh I added a new tab but forgot to handle it in this switch" bug at compile time.
- Documents intent: "these cases are the universe; nothing else is possible."

**Where.**
- `ToolMenu.tsx` → `contentFor` (iter 5 review added this).
- Future simulations over automaton type, status, etc. should use the same pattern.

**Mistakes to avoid.**
- Assuming TypeScript checks exhaustiveness by default — it doesn't.
- Falling back to `throw new Error('unreachable')` at runtime — catches the bug too late.

---

## 16. Global notification store with source highlighting (iter 6)

**The rule.** All user-facing errors, warnings, and successes flow through a single React Context-backed store. The store also tracks one "highlighted target" — a reference to a state, transition, or alphabet symbol — that components observing the store visually pulse. Any component can `notify({...})` via `useNotifications()`.

**Why.**
- One UI surface for all messaging — users always look in the same place.
- Source-of-error highlighting is automatic: tag a notification with a target, and the matching row + canvas element pulse for ~2s.
- Inline error banners scattered across editor panels disappear; their replacement is a single stack of toasts in the top-right.
- Decouples error reporting from layout — errors don't have to live near the form that produced them.

**Where.**
- `src/notifications/types.ts` — `Notification`, `NotificationSeverity`, `NotificationTarget` (discriminated union over state / transition / alphabet).
- `src/notifications/NotificationContext.tsx` — `NotificationProvider` owns the store; manages auto-dismiss timers and highlight timeouts.
- `src/notifications/useNotifications.ts` — hook that throws helpfully if used outside the provider.
- `src/notifications/NotificationStack.tsx` + `NotificationToast.tsx` — fixed top-right UI.
- `src/main.tsx` — wraps `<App />` in `<NotificationProvider>`.
- `src/App.tsx` — derives `highlightedStateId` / `highlightedTransition` / `highlightedSymbol` from the store and passes each to the matching component. `applyEdit()` uses pre-check + functional updater so error notifications don't fire twice under StrictMode.
- `src/components/AutomatonCanvas.tsx`, `StateNode.tsx`, `TransitionEdge.tsx` — receive highlight props, apply pulse-canvas SVG class.
- `src/components/toolMenu/StateEditor.tsx`, `TransitionEditor.tsx`, `AlphabetEditor.tsx` — receive highlight props, apply pulse-error class to the matching row.

**Mistakes to avoid.**
- **Calling `notify()` inside a state updater.** State updaters are pure; under StrictMode dev they run twice → notifications fire twice. Always pre-check synchronously, then commit via `setState` if no error.
- **Holding error state in multiple places.** `editError` and an inline banner duplicate the notification system. Pick one source of truth.
- **Skipping the `target` when one is meaningful.** A toast that says "duplicate transition" without highlighting *which* transition is half useful. Always include a target when the user could ask "where?"

---

## 17. Lifted reducer for cross-component coordination (iter 7)

**The rule.** When a state machine's transitions can be triggered from *multiple* sibling components, lift the reducer up to their common parent. Pass `state` + `dispatch` down as props. Children become controlled.

**Why.**
- A state machine has a single source of truth. If one child owns it locally, siblings can't dispatch into it cleanly.
- `useReducer` keeps logic centralized and testable as a pure function.
- Effects that depend on the state can live in the parent, where they can observe transitions and react (e.g., toggling another component's mode).

**Where.**
- `App.tsx` → `creationReducer`. Owns the transition-creator's state machine. Hands it down to `TransitionCreator` as props.
- The canvas (`AutomatonCanvas`) dispatches `sourcePicked` / `destinationPicked` when the user clicks state nodes during a picking phase. The canvas doesn't know about `TransitionCreator` — it just calls `onPickState(stateId)`, which App routes to `creationDispatch`.
- App also uses the lifted state to derive `canvasPickMode` (canvas affordance) and `overwriteTarget` (warning highlight).

**Mistakes to avoid.**
- Keeping the reducer local when other components need to peek at or dispatch into it. You'll end up with imperative refs / event buses or duplicated state.
- Forgetting to expose dispatch to siblings — they'll try to encode the same business logic via callback chains.

---

## 18. Generalized component click API for multi-mode interactions (iter 7)

**The rule.** When a UI element supports multiple click behaviors depending on app state, give it ONE generalized click prop and let the parent decide what to do. Don't proliferate per-mode handlers (`onPick`, `onSelect`, `onEdit`, …) on the element itself.

**Why.**
- The element shouldn't know what mode the app is in.
- The parent has the context to wire the right behavior.
- Simpler component API, easier to add new modes later.

**Where.**
- `StateNode` originally had `onPick` (used during transition picking). When state-actions clicks were added, instead of adding `onSelect`, `onPick`, `onEdit` etc., the API became:
  ```typescript
  isInteractive: boolean;
  interactionStyle: 'pick' | 'select';   // visual affordance only
  onClick: (anchorEl: SVGGElement) => void;
  ```
- `AutomatonCanvas` decides what to wire based on app state: pick-mode click → `onPickState`; otherwise → `onStateClick`. StateNode doesn't need to know which.

**Mistakes to avoid.**
- Adding a new click-purpose prop for every new behavior. Signal of accumulating coupling.
- Letting the leaf component check app state to decide what to do. That's the parent's job.

---

## 19. Floating popovers anchored against the menu, not the trigger (iter 7)

**The rule.** When a popover is conceptually "associated with the sidebar," anchor it to the right of the sidebar (a stable reference) rather than purely below its trigger element. This avoids the popover overlapping unrelated sidebar content.

**Why.**
- A popover below a trigger can cover other interactive elements in the sidebar.
- Anchoring to the menu's right edge places the popover in dead space (the canvas area is wide).
- All popovers consistently appear in the same region, which feels less surprising.

**Where.**
- `StatePickerPopover` and `StateActionsPopover` both compute `left = .tool-menu-open.getBoundingClientRect().right + 8`. Top is aligned vertically with the trigger.
- Popover uses `position: fixed` so it can escape the sidebar's overflow context.

**Mistakes to avoid.**
- Anchoring purely below/inside the trigger when the trigger is in a constrained scrollable container — popover gets clipped by overflow.
- Using `position: absolute` inside a sidebar with `overflow: auto`. The popover gets clipped and scrolls with the content.

---

## 20. Canvas as the editor, sidebar as the assist (iter 7)

**The rule.** When a feature has natural visual representation, prefer to make the visual representation directly editable (canvas-first), with the sidebar serving as a parallel input path / preview / orientation tool.

**Why.**
- Canvas-first matches how users think about visual structures (DFAs, diagrams, flowcharts).
- Removes the impedance mismatch of describing visual things in tables.
- The mini SVG in `TransitionCreator` is an example of *bidirectional* coupling: the form previews on a small SVG, and the canvas IS the form's input field for state picks and edge selection.

**Where.**
- `TransitionCreator` mini SVG previews the in-progress transition.
- Clicking a state node on the canvas picks it for the form (during pick mode) OR opens its action popover (otherwise).
- Clicking an edge on the canvas loads it into the form for edit/delete.
- The sidebar still has all the controls — but the canvas is the primary surface for editing operations whose "object" is something on screen.

**Mistakes to avoid.**
- Trying to fit large structured data (transition tables) into a narrow sidebar. The width constraints will fight every layout decision.
- Hiding interactive affordances in the sidebar when the user's mental model is "I want to act on THIS thing on the canvas."

---

## Patterns we *haven't* needed yet (watch for them)

These aren't in the codebase but are likely to appear in future iterations:

- **React Context** — when App.tsx's prop-threading becomes tedious (likely around iteration 8+).
- **Custom hooks for UI state** — `useToolMenu()` to extract the menu FSM logic from App.tsx.
- **Memoization** (`useMemo`, `useCallback`) — once we have a state large enough that re-render costs matter.
- **Suspense / lazy loading** — if we add heavy dependencies (e.g., large visualizations).
- **Structural sharing libraries** (Immer) — if immutable updates get syntactically painful with deeply nested data.

---

## How to use this document

When you're stuck on a design decision in a future iteration, skim this file. If the pattern you need is here, apply it. If it isn't — the decision deserves a deliberate choice, and potentially a new entry.

When you write a new iteration, append any new patterns to this doc. Each entry should have all four sections (rule / why / where / mistakes). If a pattern only has one of those, it's not generalizable yet; leave it as ad-hoc code for now.
