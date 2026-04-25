/**
 * useKeyboardScope
 *
 * Stack-based global keyboard handling. Replaces the proliferation of
 * per-feature `document.addEventListener('keydown', ...)` calls — each of
 * which had to grow its own blacklist ("not in INPUT, not over the popover,
 * not while another modal is open...") to coexist with the others.
 *
 * Model:
 * - A module-level singleton stack of registered scopes.
 * - When a hook with `active: true` mounts (or flips to active), it pushes
 *   onto the stack. When it unmounts (or flips inactive), it removes itself.
 * - Exactly one document-level `keydown` listener is registered lazily on
 *   the first push and torn down when the last scope leaves.
 * - On a key event, the listener walks the stack from the top down, calling
 *   each `onKey` until either:
 *     * a `capture: true` scope is reached — that scope owns the key; walking
 *       stops there regardless of its return value, AND the event is
 *       prevented/stopped to keep it from leaking to other React handlers,
 *     * a transparent (`capture: false`) scope returns truthy or calls
 *       preventDefault — the event is consumed; walking stops,
 *     * the bottom of the stack is reached without a consumer — the event
 *       passes through untouched.
 *
 * Text-input filter:
 * - By default the listener short-circuits when focus is inside an
 *   <input>/<textarea>/[contenteditable] — typing into a text field should
 *   never trigger global shortcuts. Scopes that need to override this (e.g.
 *   the transition-creator's symbol-input Enter handler that *wants* to fire
 *   inside its own input) opt in via `inTextInputs: true`.
 * - The check is applied per-scope at walk time, so a transparent
 *   "ignore-text-inputs" scope can sit beneath a "fires-anywhere" scope
 *   without interfering.
 */

import { useEffect, useRef } from 'react';

export type KeyHandler = (event: KeyboardEvent) => boolean | void;

export type KeyboardScopeOptions = {
  /** Identifier used in dev-only stack logging. */
  id: string;
  /**
   * Whether this scope captures (modal) or passes through (transparent).
   * - `true`: while at the top of the stack, this scope owns ALL keys. The
   *   handler may still return falsy to indicate it didn't act, but the
   *   event won't bubble to lower scopes either way.
   * - `false` (default): the handler runs first, but if it returns
   *   falsy without calling preventDefault, the event continues down the
   *   stack.
   */
  capture?: boolean;
  /**
   * If true, the handler also fires when focus is inside a text input.
   * Default: false (matches the implicit blacklist behavior the migrated
   * listeners used to enforce by hand).
   */
  inTextInputs?: boolean;
  /**
   * Called on every keydown that reaches this scope. Return `true` (or call
   * `event.preventDefault()`) to consume the event. Returning `false` /
   * `undefined` lets it continue to the next scope down (when transparent).
   */
  onKey: KeyHandler;
  /** When false, the scope is removed from the stack. */
  active: boolean;
};

type RegisteredScope = {
  id: string;
  capture: boolean;
  inTextInputs: boolean;
  onKey: KeyHandler;
};

// Module-level singleton. The stack is shared across every hook invocation
// in the running app, which is exactly what we want — keyboard state is a
// global concern.
const scopeStack: RegisteredScope[] = [];
let listenerInstalled = false;

/**
 * Returns true when the active element is a text-entry surface and would
 * normally swallow user keystrokes. Centralizes the duck-typing check that
 * the three migrated listeners each duplicated.
 */
export function isTextInputFocused(): boolean {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement) return true;
  if (active instanceof HTMLTextAreaElement) return true;
  if (active instanceof HTMLElement && active.isContentEditable) return true;
  return false;
}

function handleDocumentKeyDown(event: KeyboardEvent) {
  // Walk the stack top-down. We snapshot the length here because a handler
  // could theoretically pop itself off (e.g. a popover closing on Escape);
  // iterating with a fixed end index keeps us from skipping a sibling that
  // shifted down a slot during the walk.
  const inText = isTextInputFocused();
  for (let index = scopeStack.length - 1; index >= 0; index--) {
    const scope = scopeStack[index];
    if (!scope) continue;
    // Default-off text-input filter. Scopes that opt in receive the event
    // even when focus is in a field.
    if (inText && !scope.inTextInputs) {
      // Captures still block lower scopes even when they themselves don't
      // run, so the rule "modal owns keys" holds in text fields too.
      if (scope.capture) return;
      continue;
    }
    const consumed = scope.onKey(event) === true || event.defaultPrevented;
    if (scope.capture) {
      // Capturing scope: stop walking regardless of consume status.
      return;
    }
    if (consumed) return;
  }
}

function ensureListener() {
  if (listenerInstalled) return;
  document.addEventListener('keydown', handleDocumentKeyDown);
  listenerInstalled = true;
}

function teardownListenerIfEmpty() {
  if (scopeStack.length > 0) return;
  if (!listenerInstalled) return;
  document.removeEventListener('keydown', handleDocumentKeyDown);
  listenerInstalled = false;
}

/**
 * Register a scope on the global keyboard stack. The scope is active only
 * while `options.active` is true; mounting with active=false is a no-op and
 * the scope will register the moment active flips true.
 *
 * The handler reference is captured in a small adapter that always reads
 * the *latest* options out of the closure, so callers don't need to memoize
 * `onKey` to keep their handler fresh between renders.
 */
export function useKeyboardScope(options: KeyboardScopeOptions): void {
  const { id, active, capture, inTextInputs, onKey } = options;

  // Latest-handler ref so the registered scope's adapter always reads the
  // freshest `onKey`. Without this, the closure captured at effect-mount
  // time would go stale after the first re-render, causing handlers to
  // reference outdated state.
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;

  useEffect(() => {
    if (!active) return;
    const scope: RegisteredScope = {
      id,
      capture: capture === true,
      inTextInputs: inTextInputs === true,
      // Adapter reads through the ref so the live handler is invoked on
      // every event, not the one captured at registration time.
      onKey: (event) => onKeyRef.current(event),
    };
    scopeStack.push(scope);
    ensureListener();
    return () => {
      const indexInStack = scopeStack.indexOf(scope);
      if (indexInStack >= 0) scopeStack.splice(indexInStack, 1);
      teardownListenerIfEmpty();
    };
  }, [id, active, capture, inTextInputs]);
}

/** Test-only: drain the global stack between tests. */
export function __resetKeyboardScopeForTests() {
  scopeStack.length = 0;
  if (listenerInstalled) {
    document.removeEventListener('keydown', handleDocumentKeyDown);
    listenerInstalled = false;
  }
}
