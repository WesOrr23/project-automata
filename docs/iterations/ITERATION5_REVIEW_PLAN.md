# Iteration 5 Review Plan

A strategic methodology for walking through every file added or modified in Iteration 5. This is designed for a learning review — Wes reads each file while we systematically unpack what every block does, why it does it that way, and how it plugs into the rest of the app.

---

## The Walk-Through Pattern

For every file, we'll use the same 5-step pattern:

**1. Role in the system (1 sentence)**
Where does this file sit in the layered architecture? What question does it answer? What other files depend on it?

**2. Imports — what's pulled in and why**
Every import reveals a dependency. We'll categorize each one:
- Runtime values (components, functions, hooks)
- Types (`import type`)
- CSS / external assets
Why each is needed.

**3. Type definitions — the shape of the data**
What types does this file declare? What invariants do they encode? What does each field mean?

**4. Block-by-block code walkthrough**
For each function, effect, or JSX block:
- **What it does** — plain-English summary
- **How it works** — mechanics (the specific React/JS/TS feature in play)
- **Why it's written this way** — alternatives considered, trade-offs
- **Connections** — what upstream code feeds in, what downstream code consumes

**5. Failure modes + open questions**
- What happens when X is empty / null / invalid?
- Where does the code assume an invariant that isn't enforced?
- What would you change if you were refactoring?

At the end of each file, we also answer: **what concepts did this file require you to understand?** (React, TS, FP, browser APIs, etc.) — this becomes the concept inventory you've built up by the end.

---

## Review Order

Files are reviewed **bottom-up** — from foundational pieces with no dependencies, toward the orchestrating pieces at the top. This way, when you review a file, every piece it imports has already been explained.

### Tier 1 — Foundation (no new dependencies, just types and config)

1. **`src/components/toolMenu/types.ts`**
   - Pure TypeScript. No React. Good warm-up.
   - Concepts: string literal unions, discriminated unions, `readonly` arrays, type-only imports, static config patterns.

### Tier 2 — Leaf components (depend only on types + existing primitives)

2. **`src/components/toolMenu/ToolMenu.tsx`**
   - The container component with the 3-state rendering.
   - Concepts: functional components, JSX, props destructuring, `.map()`, `key`, dynamic component references (`const Icon = tab.icon`), conditional rendering via early returns + `&&`, event handlers (inline vs direct), TypeScript narrowing across branches.

3. **`src/components/toolMenu/StateEditor.tsx`**
   - Pure form component for state CRUD. No local state.
   - Concepts: derived values (`sortedIds`, `canDelete`), controlled toggles (button active state from prop), `disabled` with tooltip as UX affordance, icon button pattern.

4. **`src/components/toolMenu/ConfigPanel.tsx`**
   - First component with **local state** (`useState` for draft symbol and error).
   - Concepts: `useState`, controlled inputs, `onKeyDown` for Enter-to-submit, validation flow, error clearing, `maxLength` as defense-in-depth.

5. **`src/components/toolMenu/TransitionEditor.tsx`**
   - Form component combining dropdowns and a dynamic list.
   - Concepts: multiple `useState`, `onChange` with `Number()` coercion, using the function signature of `onAddTransition: () => string | null` as an error channel, sort stability with composite comparators.

### Tier 3 — Composite (depend on Tier 2)

6. **`src/components/toolMenu/EditPanel.tsx`**
   - Pure composition — renders `StateEditor` + `TransitionEditor` + error banner.
   - Concepts: component composition, passing callback chains through props ("prop forwarding"), accessibility patterns (`role="button"`, `tabIndex`, keyboard handlers).

### Tier 4 — Orchestrator (depends on everything)

7. **`src/App.tsx`**
   - The big one. State ownership, hooks, effects, handler wiring, render composition.
   - Concepts: `useState`, `useEffect`, `useRef`, derived state, lifted state, cleanup functions, debouncing, version counters for race conditions, `useRef` for mutable values that don't trigger re-renders, cascade-delete semantics, pure-function error catching, `Blob` + `URL.createObjectURL` for file downloads, derived enum types from discriminated unions.

### Tier 5 — Styling (reviewed after we know what the classes mean)

8. **`src/index.css`** (the new sections added in iter 5)
   - Concepts: CSS custom properties as design tokens, `:root` variables, responsive transitions, the `.active` / `.compact` / `.danger` modifier pattern, `position: fixed` + `transform` for centered overlays, hover states with `:not(:disabled)` guards.

---

## Per-File Checklist

When we review each file, we'll concretely answer these questions:

### `types.ts`
- [ ] What's the difference between `ToolTabID` and `ToolTabConfig`?
- [ ] Why is `ToolMenuState` a discriminated union and not an interface?
- [ ] What does `readonly ToolTabConfig[]` protect against?
- [ ] Why uppercase string literals when existing code uses lowercase?

### `ToolMenu.tsx`
- [ ] Walk through the 3 rendering branches. Why early returns instead of one big switch?
- [ ] What does `const Icon = tab.icon` achieve that `<tab.icon />` wouldn't?
- [ ] Why is `onClick={isActive ? undefined : () => onTabClick(tab.id)}` preferred over `onClick={() => isActive || onTabClick(tab.id)}`?
- [ ] After the two early returns, how does TypeScript know `state.activeTab` is safe to access?

### `StateEditor.tsx`
- [ ] Walk through the data flow from props → rendered list → user action → prop callback.
- [ ] Why is `canDelete = states.size > 1` derived locally instead of passed from App?
- [ ] What's the reason the start-state button uses `disabled={isStart}`?

### `ConfigPanel.tsx`
- [ ] Why is `draftSymbol` and `error` local state, not lifted to App?
- [ ] Trace an "add symbol" interaction step-by-step.
- [ ] What's the role of `setError(null)` on input change?

### `TransitionEditor.tsx`
- [ ] What happens when the alphabet is empty? Is the UI still safe?
- [ ] Walk through `onAddTransition`'s return type: when is it `null`, when is it a string?
- [ ] Why does `handleAdd` return early if `sortedAlphabet.length === 0`?

### `EditPanel.tsx`
- [ ] Why is this component so thin? What's the value of having it at all?
- [ ] How does the error banner meet WCAG keyboard requirements?

### `App.tsx`
- [ ] Trace the full flow: user types a symbol → automaton changes → canvas re-renders. What runs, in what order?
- [ ] Why does the layout effect need a version counter?
- [ ] Walk through what happens when the user:
  - Clicks the Edit tab for the first time
  - Deletes a state
  - Switches to Simulate tab with a non-runnable automaton
  - Clicks Export JSON
- [ ] What is the `previousAppMode` ref used for? Why `useRef` instead of `useState`?
- [ ] What's the point of `isFirstRender.current`?

### `index.css` (new sections)
- [ ] What's the CSS specificity chain that makes `.tool-menu-card.active` override `.tool-menu-card`?
- [ ] How does `transform: translateY(-50%)` achieve vertical centering, and why does it need `top: 50%`?
- [ ] Why are `.editor-row-action.active` styles separate from `.editor-row-action` — what CSS cascade feature is used?

---

## Session Structure (Suggested)

Budget 20–30 minutes per file. Over two sittings:

**Sitting 1 (Foundation + leaves, ~90 min):**
- types.ts
- ToolMenu.tsx
- StateEditor.tsx
- ConfigPanel.tsx

**Sitting 2 (Composite + orchestrator + styling, ~90 min):**
- TransitionEditor.tsx
- EditPanel.tsx
- App.tsx
- index.css (new sections)

After each sitting: we summarize the concepts introduced and how the files we covered form a coherent layer of the system.

---

## Deliverable at the End

By the time we finish this review, you should have:

1. A clear mental model of how a prop flows from `App.tsx` down to a leaf button and back up as a callback.
2. Comfortable vocabulary for React hooks, effects, refs, and patterns like lifting state.
3. Recognition of the TypeScript features in play: discriminated unions, literal types, narrowing, readonly.
4. Understanding of how to read a React component "cold" — from imports → types → render.

We'll reference the companion `ITERATION5_ARCHITECTURE.md` throughout. The architecture doc gives you the top-down view (what the system does); this review plan takes you bottom-up through the implementation.
