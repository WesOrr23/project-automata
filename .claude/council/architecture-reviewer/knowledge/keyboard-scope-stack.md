---
agent: architecture-reviewer
type: knowledge
topic: keyboard-scope-stack
schema-version: 1
verified-as-of: dd6420b
last-updated: 2026-04-27
confidence: high
---

# Keyboard Scope Stack

## Principle

Global keyboard handling routes through a single module-level stack of registered scopes. Components register a scope via `useKeyboardScope` when they want to receive keys; only the topmost active scope receives keypresses. Scopes can be **capturing** (keys not handled bubble out) or **transparent** (keys not handled fall through to the next scope down). One document-level `keydown` listener replaces N independent listeners with N independent blacklists.

## Origin

Iteration 11. Replaced four independent global `keydown` listeners (App's undo/redo, TransitionCreator's Enter and type-to-modify, StateActionsPopover's Esc/Space/Del) each maintaining its own carve-out blacklist (`tagName === 'INPUT'`, `isContentEditable`, `querySelector('.state-actions-popover')`).

## Shape

```typescript
// src/hooks/useKeyboardScope.ts
type KeyHandler = (event: KeyboardEvent) => boolean | void;

useKeyboardScope({
  id: 'app-undo-redo',
  onKey: (e) => { /* handle Cmd+Z etc. */ },
  active: true,
  capture: false, // transparent — passes through if not handled
});
```

Internal: a module-level `Array<{ id, capture, onKey }>` stack. One lazily-installed document `keydown` listener walks the stack from the top. Each `onKey` is invoked with a "latest-handler" ref pattern so callers don't need to memoize.

## Default text-input filter

The listener filters out keys when focus is inside `<input>`, `<textarea>`, or `[contenteditable]` — a single shared check (`isTextInputFocused()`) replacing the duplicated blacklist that used to live at every callsite. Scopes that explicitly want keys even in text inputs can opt in via `inTextInputs: true`.

## What to look for in diffs

- New `document.addEventListener('keydown', ...)` in components — should use `useKeyboardScope` instead. (One known residue: `StatePickerPopover.tsx` was not migrated in iter-11; flagged for cleanup.)
- New keyboard handlers that re-implement the text-input blacklist — should rely on the shared filter.
- Modal-style components that register a scope without `capture: true` — modals should capture by default to prevent keys leaking down to the editor.
- `useKeyboardScope` calls without an `active` flag tied to component visibility — the scope should auto-deregister when the component closes/hides.

## What's fine

- Component-local `onKeyDown` props on actual input elements (text fields) — the scope manager is for *global* keys, not for input-element-local handling.
- Multiple transparent scopes registered simultaneously — they coexist, walk in stack order.
- Capturing scopes preempting transparent ones — exactly what they're for (modals owning their key set).

## Migration history

The four global `keydown` listeners that existed pre-iter-11 (App's undo/redo, TransitionCreator's Enter and type-to-modify, StateActionsPopover's Esc/Space/Del, StatePickerPopover's Escape) were all migrated to `useKeyboardScope` during iter-11 — three in commit `e666a06` and the fourth (StatePickerPopover) in cleanup commit `632ac70`.

**Iter-12 regression:** five new components introduced raw `document.addEventListener('keydown', ...)` instead of going through the scope stack:
- `useDebugOverlay` — ⌘⇧D toggle (would clobber any modal that wanted Cmd+Shift+D for itself; should be a transparent scope).
- `Onboarding` — Esc to dismiss. Worst offender: this is modal-flavored, should register a `capture: true` scope so Esc doesn't leak to whatever sits behind the dim overlay.
- `CommandBar` — Esc to close active popover.
- `ComparePicker` — Esc to close.
- `BatchTestModal` — Esc to dismiss. Modal-flavored, same issue as `Onboarding` — should be a `capture: true` scope. (Added in commit `7a0832b`, after the architect's iter-12 close-out diff snapshot at `369cd14`; not visible in the close-out journal but caught by audit-003 F3.)

All five should be migrated to `useKeyboardScope`. Recorded in `journal/2026-04-27-iter12-closeout.md` and `auditor/journal/audits/2026-04-27-audit-003.md` (F3). Until cleaned up, the "no raw `document.addEventListener('keydown')` remains" claim from iter-11 is no longer true.

## Provenance

Iteration 11 implementation. `src/hooks/useKeyboardScope.ts` and the migrations in `App.tsx`, `TransitionCreator.tsx`, `StateActionsPopover.tsx`.
