# Iteration 6 — Notification System

## Goal

Replace every scattered inline error banner in the app with a single, global notification system. Notifications stack in the top-right of the viewport, carry severity, can highlight the offending source on canvas AND in the tool menu, and expose a clean `useNotifications()` hook for any component to fire them.

This sets up error infrastructure cleanly *before* Iteration 7 (NFA support) introduces a new wave of validation concerns that would otherwise get bolted onto the existing ad-hoc system.

---

## Architectural summary

One context provider at the app root owns the notification store. Every component consumes it via a hook. Notifications carry a target reference (state ID, transition, alphabet symbol, or nothing) that components observing the store can read to trigger visual highlighting.

```
  ┌──────────────────────────────────┐
  │  NotificationProvider (root)     │
  │  ┌────────────────────────────┐  │
  │  │  store: Notification[]     │  │
  │  │  notify() / dismiss()      │  │
  │  └────────────────────────────┘  │
  └──────────────────────────────────┘
                │
        useNotifications() hook
                │
  ┌─────────────┼─────────────┐
  │             │             │
App.tsx     Editor       Canvas
notify()    notify()    reads store
            highlights  highlights
              rows      matching
                        targets
```

### New primitives

**`Notification`**:
```typescript
type Notification = {
  id: string;                    // uuid
  severity: 'error' | 'warning' | 'info' | 'success';
  title: string;                 // short, visible at a glance
  detail?: string;               // expanded description, shown on click
  target?: NotificationTarget;   // what to highlight
  createdAt: number;             // for auto-dismiss timing
  autoDismissMs?: number;        // override per-severity default
};

type NotificationTarget =
  | { kind: 'state'; stateId: number }
  | { kind: 'transition'; from: number; to: number; symbol: string | null }
  | { kind: 'alphabet'; symbol: string };
```

**Highlight lifecycle:**
When a notification is created, its target is "active" for ~2 seconds. The canvas and the relevant editor rows watch for active-target IDs and render with a pulse/flash. After the active window, the highlight fades but the notification stays in the stack. Clicking the notification re-activates the highlight for another ~2 seconds.

---

## Phases

### Phase 1 — Foundation (types + Context + hook)

Lay down the state management without any UI yet.

**New files:**
- `src/notifications/types.ts` — `Notification`, `Severity`, `NotificationTarget`
- `src/notifications/NotificationContext.tsx` — React Context + `NotificationProvider` component that owns the store
- `src/notifications/useNotifications.ts` — `useNotifications()` hook exposing `{ notifications, notify, dismiss, highlightedTarget }`
- `src/main.tsx` (modified) — wrap `<App />` in `<NotificationProvider>`

**Logic:**
- `notify({...})` generates a UUID, appends to array.
- `dismiss(id)` removes.
- `highlightedTarget` state is the most-recently-activated target; auto-clears after 2 seconds via a ref-stored timeout.
- `notify()` also activates highlight. Clicking a notification re-invokes the activation.

**Test:** Add `src/notifications/NotificationContext.test.ts` covering notify, dismiss, highlight lifecycle as a pure reducer (if we use useReducer) or via renderHook.

**Commit:** "Phase 1 (iter 6): Notification store + hook foundation"

---

### Phase 2 — Toast UI

Build the visual layer. Notifications render in a top-right stack, each a toast with severity coloring and expand-on-click.

**New files:**
- `src/notifications/NotificationToast.tsx` — single toast. Shows title + severity icon. Click toggles expanded state showing `detail`. Keyboard: Enter/Space toggle, Escape dismiss when focused.
- `src/notifications/NotificationStack.tsx` — fixed position top-right, renders the toasts via `useNotifications()`.
- CSS additions in `src/index.css`:
  - `.notification-stack` (fixed position, z-index above everything else)
  - `.notification-toast` base + severity variants (error/warning/info/success)
  - Entry/exit transitions (slide in from right, fade out)

**Integration:**
- `App.tsx` renders `<NotificationStack />` once at the top level so toasts appear regardless of which tab is open.

**Visual notes:**
- Severity → color (reuse existing `--error-*`, `--success-*`, add warning tokens).
- Short titles: one line, max 60 chars, no wrap.
- Click title/icon to expand/collapse. Expanded shows `detail` paragraph.
- Auto-dismiss defaults per severity: error = sticky (manual dismiss only), warning = 10s, info = 6s, success = 4s.

**Commit:** "Phase 2 (iter 6): Toast stack UI"

---

### Phase 3 — Source highlighting

When a notification has a `target`, visually pulse that thing on the canvas and in the tool menu.

**Engine-side (no changes):**
The highlighting is purely a UI concern; engine data stays the same.

**Canvas-side:**
- `AutomatonCanvas` receives `highlightedTarget` via prop (plumbed from App.tsx).
- `StateNode` adds a pulse animation when its `stateId` matches a state-kind target.
- `TransitionEdge` adds a pulse when `from/to/symbol` match a transition-kind target.

**Tool menu-side:**
- `StateEditor` accepts `highlightedStateId` prop; the matching row gets a CSS animation class.
- `TransitionEditor` accepts `highlightedTransition` prop; the matching row gets the same treatment.
- `AlphabetEditor` accepts `highlightedSymbol` prop for alphabet-kind targets.

**CSS:**
- `@keyframes pulse` — brief highlight cycle, ~2s, 2–3 pulses of color.
- `.pulse-error`, `.pulse-warning` — severity-colored variants.

**App.tsx wiring:**
- `const { highlightedTarget } = useNotifications()` inside App.
- Derive `highlightedStateId`, `highlightedTransition`, `highlightedSymbol` from the target's kind.
- Pass the relevant one to each consumer.

**Commit:** "Phase 3 (iter 6): Source highlighting for notifications"

---

### Phase 4 — Retrofit existing error sites

Delete the old ad-hoc error banners and replace them with `notify()` calls.

**Sites to migrate:**

1. **App.tsx `editError`** — delete the state entirely. Replace every `setEditError(msg)` with `notify({ severity: 'error', title: msg, target: ... })`. Attach a `target` where known (e.g., duplicate transition notification targets the existing conflicting transition).

2. **TransitionEditor inline error banner** — delete the whole `{error && ...}` block. Errors now flow through notifications. The `error` + `onDismissError` props disappear from the component's API.

3. **AlphabetEditor inline error text** — same treatment. Local error state (`const [error, setError]`) stays for *input validation* (empty, too long, duplicate), but those errors also fire notifications so they live in the stack. Subtle: UI still needs some immediate in-form feedback so the local state helps there, but the notification system is the canonical place.

4. **ValidationView in SimulateTab** — render a notification when entering Simulate with a non-runnable automaton. The inline ValidationView component can stay (it's useful in-context), but its errors also appear as stacked notifications users can revisit.

**Consequences:**
- App.tsx shrinks (removes `editError`, removes `setEditError`, cleaner).
- Editor components simplify (no more error props).
- Users get consistent error UX everywhere in the app.

**Commit:** "Phase 4 (iter 6): Migrate error sites to notification system"

---

### Phase 5 — Polish + tests + docs

**Accessibility:**
- Stack is `role="region"`, `aria-label="Notifications"`, `aria-live="polite"`.
- Each toast is `role="alert"` (errors/warnings) or `role="status"` (info/success).
- Keyboard: Tab to focus a toast, Enter/Space to expand, Escape to dismiss, Delete/Backspace to dismiss.

**Tests:**
- `NotificationContext.test.ts` — reducer / hook behavior.
- `NotificationStack.test.tsx` — rendering, interaction via testing-library.
- (Defer deeper integration tests; relies on DOM which needs jsdom config.)

**Docs:**
- Update `ARCHITECTURAL_PATTERNS.md` with a new entry: "Global notification store with source highlighting." Patterns introduced: React Context, `useContext`, source-target targeting.
- Update `CLAUDE.md` — mark iteration 6 complete, describe delivered features.

**Commit:** "Phase 5 (iter 6): Polish + tests + docs"

---

## Files summary

### New files (8)
- `src/notifications/types.ts`
- `src/notifications/NotificationContext.tsx`
- `src/notifications/useNotifications.ts`
- `src/notifications/NotificationToast.tsx`
- `src/notifications/NotificationStack.tsx`
- `src/notifications/NotificationContext.test.ts`
- `src/notifications/NotificationStack.test.tsx`
- `ITERATION6_PLAN.md` (this file)

### Modified files (approx 7)
- `src/main.tsx` — wrap App in provider
- `src/App.tsx` — delete editError, consume highlightedTarget, render NotificationStack, call notify()
- `src/components/toolMenu/EditPanel.tsx` — drop error + onDismissError props
- `src/components/toolMenu/TransitionEditor.tsx` — drop error + onDismissError, notify on duplicates
- `src/components/toolMenu/AlphabetEditor.tsx` — notify on alphabet errors
- `src/components/toolMenu/StateEditor.tsx` — accept highlightedStateId for pulsing
- `src/components/AutomatonCanvas.tsx` + `StateNode.tsx` + `TransitionEdge.tsx` — pulse on highlight
- `src/index.css` — notification + pulse styles
- `ARCHITECTURAL_PATTERNS.md` — new pattern entry
- `CLAUDE.md` — iteration 6 complete marker

### Unchanged
- All engine files — zero changes. Notification is pure UI.
- `useSimulation` hook — unchanged.
- `ui-state/utils.ts` — unchanged.

---

## Risks

1. **Over-engineering.** A notification system is infrastructure; easy to add knobs (positioning, themes, grouping) that won't be used. Mitigation: ship the minimal feature set this plan describes; accept PRs only if they solve observed friction.

2. **Context re-render performance.** Every notify() change re-renders anyone consuming the context. With a few notifications and a shallow tree, this is fine. If it becomes an issue later, split into separate context for `highlightedTarget` (hot) vs the stack (cold).

3. **Highlight timing races.** If two notifications with different targets fire ~1s apart, the second should preempt the first's highlight. Implementation: store a single `highlightedTarget` and reset its timeout on each notify.

4. **Existing tests might break** if they assert on `editError` rendering. None currently do (unit tests are engine+hook only), so safe.

---

## Verification

After each phase:
- `npm test -- --run` — all existing tests pass.
- `npx tsc --noEmit` — clean typecheck.
- Manual: fire a notification from each severity, verify stack, expand, dismiss, highlighting.

End-to-end verification:
1. Trigger duplicate transition. See error toast top-right. Expand detail. Conflicting transition pulses in list + canvas.
2. Add invalid alphabet symbol (empty). Warning toast. Dismissed on fix.
3. Switch to Simulate with broken automaton. Error toast listing missing transitions. Each clickable to re-highlight.
4. Keyboard: tab through toasts, Enter expands, Escape dismisses. Screen reader announces new error toasts automatically.
