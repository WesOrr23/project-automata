# Iteration 6 — Notification System (COMPLETE)

**Status**: Complete
**Branch**: `iteration-6`
**Test count**: 142 (up from 131; 11 new for the notification store)

---

## What shipped

A unified notification system that replaces every scattered inline error banner. Notifications stack in the top-right of the viewport, carry severity, and can highlight the offending source on the canvas AND in the tool menu.

### Five phases, five commits

1. **Phase 1 — Foundation** — types, Context, hook, provider mounted at root.
2. **Phase 2 — Toast UI** — `NotificationStack` + `NotificationToast` with severity colors, expand-on-click detail, keyboard support, slide-in animation.
3. **Phase 3 — Source highlighting** — pulse animations on editor rows, alphabet badges, state nodes, transition edges. App.tsx derives per-component highlight props from `useNotifications().highlightedTarget`.
4. **Phase 4 — Migration** — deleted `editError` state, dropped error/onDismissError props from `EditPanel` + `TransitionEditor`. All errors flow through `notify()` with targets.
5. **Phase 5 — Tests + docs** — jsdom + testing-library set up; 11 reducer-style tests for the notification store; this completion doc and an architectural pattern entry.

---

## API surface (for future iterations)

Anywhere in the React tree, under `<NotificationProvider>`:

```typescript
const { notifications, highlightedTarget, notify, dismiss, rehighlight } = useNotifications();

notify({
  severity: 'error' | 'warning' | 'info' | 'success',
  title: string,                      // short, always visible
  detail?: string,                    // expandable description
  target?: NotificationTarget,        // optional — what to highlight
  autoDismissMs?: number | null,      // null = sticky, undefined = severity default
});
```

Targets are a discriminated union:
```typescript
| { kind: 'state', stateId: number }
| { kind: 'transition', from: number, to: number, symbol: string | null }
| { kind: 'alphabet', symbol: string }
```

When a notification is fired, its target is the active `highlightedTarget` for `HIGHLIGHT_DURATION_MS` (2 seconds). Components reading the store apply pulse classes when their own data matches the target. Clicking a stacked notification re-activates the highlight.

---

## Auto-dismiss defaults

| Severity | Default | Rationale |
|---|---|---|
| `error` | sticky (manual dismiss) | Errors deserve user acknowledgment |
| `warning` | 10 s | Linger, but don't pile up |
| `info` | 6 s | Neutral, fades quickly |
| `success` | 4 s | Lightest, just positive feedback |

---

## Notable bug fix during Phase 4

**StrictMode double-fire of notifications.** `applyEdit` originally caught engine errors *inside* the `setAutomaton` updater and called `notify()` from the catch block. State updaters must be pure — under StrictMode dev mode, React invokes them twice to surface accidental side effects. The result: every error notification appeared twice.

**Fix:** pre-check the engine call against the current snapshot (closure value) so any error throws *outside* React's state-update lane. Only then commit through the functional updater for stale-closure safety on rapid clicks.

```typescript
function applyEdit(update, targetOnError) {
  try {
    update(automaton);                 // synchronous pre-check
  } catch (error) {
    notify({ severity: 'error', title: error.message, target: targetOnError });
    return;
  }
  setAutomaton((previous) => update(previous));   // commit
}
```

This is an important enough pattern that it's now documented in `ARCHITECTURAL_PATTERNS.md` (entry #16).

---

## Verification

- `npm test -- --run` → 142 / 142 passing.
- `npx tsc --noEmit` → clean.
- Manual:
  - Triggering a duplicate transition → single error toast in top-right; matching transition row pulses red; matching canvas edge pulses red.
  - Adding an empty alphabet symbol → error toast; no inline banner remains in AlphabetEditor.
  - Pasting >1 char into the New Symbol input → warning toast.
  - Clicking a stacked notification → re-pulse of the source.
  - Dismissing toast via X button or via Escape/Delete with toast focused.

---

## Files inventory

### New (8)
- `ITERATION6_PLAN.md`
- `ITERATION6_COMPLETE.md` (this file)
- `src/notifications/types.ts`
- `src/notifications/NotificationContext.tsx`
- `src/notifications/useNotifications.ts`
- `src/notifications/NotificationToast.tsx`
- `src/notifications/NotificationStack.tsx`
- `src/notifications/NotificationContext.test.tsx`

### Modified (10)
- `src/main.tsx` — wrap App in provider
- `src/App.tsx` — remove editError, use notify, pass highlight props
- `src/index.css` — toast styles + pulse animations
- `src/components/toolMenu/EditPanel.tsx` — drop error props, add highlight props
- `src/components/toolMenu/StateEditor.tsx` — pulse class on highlighted state
- `src/components/toolMenu/TransitionEditor.tsx` — drop error UI, add highlight matching
- `src/components/toolMenu/AlphabetEditor.tsx` — notify instead of local error state
- `src/components/AutomatonCanvas.tsx` — thread highlight props
- `src/components/StateNode.tsx` — pulse-canvas class on highlight
- `src/components/TransitionEdge.tsx` — pulse-canvas class on highlight
- `vite.config.ts` — comment about per-file jsdom opt-in
- `package.json` — jsdom + @testing-library/react + @testing-library/dom dev deps
- `ARCHITECTURAL_PATTERNS.md` — pattern #16 added

### Unchanged
- All engine files. Notifications are pure UI.

---

## What this enables for future iterations

When iteration 7 (NFA support) introduces new validation concerns ("state has multiple ε-transitions to the same target," "ambiguous transition," etc.), the wiring is already done. Each new failure mode just calls `notify({...})` with a target, and the visual feedback is automatic.

Same pattern applies to:
- File import (iter 7 sub-feature) — invalid JSON → error toast
- Drag-and-drop (iter 8) — invalid drop target → warning toast
- Animations (iter 9) — completion / step success → info or success toast
