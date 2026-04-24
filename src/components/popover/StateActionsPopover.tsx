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
import { CircleDot, Circle, CircleCheck, Trash2 } from 'lucide-react';

type StateActionsPopoverProp = {
  stateLabel: string;
  isStartState: boolean;
  isAcceptState: boolean;
  canDelete: boolean;
  /** Bounding rect of the clicked state node (for vertical alignment). */
  anchorRect: DOMRect | null;
  onSetStart: () => void;
  onToggleAccept: () => void;
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

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    function handleClick(event: MouseEvent) {
      if (popoverRef.current?.contains(event.target as Node)) return;
      onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  useEffect(() => {
    popoverRef.current?.focus();
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
        className="state-actions-popover-action danger"
        onClick={onDelete}
        disabled={!canDelete}
        title={canDelete ? 'Delete this state' : 'Cannot delete the last state'}
      >
        <Trash2 size={14} />
        <span>Delete</span>
      </button>
    </div>
  );
}
