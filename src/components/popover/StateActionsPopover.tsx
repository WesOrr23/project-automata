/**
 * StateActionsPopover
 *
 * Floating popover with quick actions for a state node clicked on the
 * canvas: set as start, toggle accept, delete. Anchored to the right of
 * the tool menu (same anchoring strategy as StatePickerPopover).
 *
 * Closes on: action button click, click outside, Escape.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CircleDot, Circle, CircleCheck, Trash2, MoveRight } from 'lucide-react';
import { useKeyboardScope } from '../../hooks/useKeyboardScope';

type StateActionsPopoverProp = {
  stateLabel: string;
  isStartState: boolean;
  isAcceptState: boolean;
  canDelete: boolean;
  /** Bounding rect of the clicked state node (for vertical alignment). */
  anchorRect: DOMRect | null;
  onSetStart: () => void;
  onToggleAccept: () => void;
  onCreateTransition: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function StateActionsPopover({
  stateLabel,
  isStartState,
  isAcceptState,
  canDelete,
  anchorRect,
  onSetStart,
  onToggleAccept,
  onCreateTransition,
  onDelete,
  onClose,
}: StateActionsPopoverProp) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!anchorRect) return;
    const menu = document.querySelector('.tool-menu-open');
    const menuRect = menu?.getBoundingClientRect();
    const left = (menuRect?.right ?? anchorRect.right) + 8;
    let top = anchorRect.top;
    const estimatedHeight = 160;
    const overflow = top + estimatedHeight - window.innerHeight + 8;
    if (overflow > 0) top -= overflow;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [anchorRect]);

  // Modal scope: while open, the popover owns Esc / Space / Del. Other
  // global scopes (e.g. transition-creator-enter) are blocked by capture:true.
  // Text-input filtering still applies via the scope manager — typing in a
  // text field elsewhere on the page doesn't trigger these shortcuts.
  useKeyboardScope({
    id: 'state-actions-popover',
    active: true,
    capture: true,
    onKey: (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return true;
      }
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        event.stopPropagation();
        onCreateTransition();
        return true;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && canDelete) {
        event.preventDefault();
        event.stopPropagation();
        onDelete();
        return true;
      }
      return false;
    },
  });

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (popoverRef.current?.contains(event.target as Node)) return;
      onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // a11y: capture the element that had focus when the popover mounted so
  // we can restore focus there on unmount. Without this, keyboard users who
  // open the popover via Space/Enter on a state node lose focus when the
  // popover closes — a real keyboard-navigation regression.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    popoverRef.current?.focus();
    return () => {
      // Only restore if the previous element is still in the DOM and
      // focusable; otherwise let the browser pick a default.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div
      ref={popoverRef}
      className="state-actions-popover"
      role="dialog"
      aria-label={`Actions for ${stateLabel}`}
      tabIndex={-1}
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="state-actions-popover-header">{stateLabel}</div>
      <button
        type="button"
        className="state-actions-popover-action"
        onClick={onSetStart}
        disabled={isStartState}
        title={isStartState ? 'Already the start state' : 'Set as start state'}
      >
        <CircleDot size={14} />
        <span>{isStartState ? 'Start state' : 'Set as start'}</span>
      </button>
      <button
        type="button"
        className="state-actions-popover-action"
        onClick={onToggleAccept}
        title={isAcceptState ? 'Unset accept state' : 'Set as accept state'}
      >
        {isAcceptState ? <CircleCheck size={14} /> : <Circle size={14} />}
        <span>{isAcceptState ? 'Unset accept' : 'Set as accept'}</span>
      </button>
      <button
        type="button"
        className="state-actions-popover-action"
        onClick={onCreateTransition}
        title="Start a new transition from this state"
      >
        <MoveRight size={14} />
        <span>New transition</span>
        <kbd className="state-actions-popover-kbd">Space</kbd>
      </button>
      <button
        type="button"
        className="state-actions-popover-action danger"
        onClick={onDelete}
        disabled={!canDelete}
        title={canDelete ? 'Delete this state' : 'Cannot delete the last state'}
      >
        <Trash2 size={14} />
        <span>Delete</span>
        <kbd className="state-actions-popover-kbd">Del</kbd>
      </button>
    </div>
  );
}
