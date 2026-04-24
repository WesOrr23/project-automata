/**
 * StatePickerPopover
 *
 * A floating list of selectable options, anchored to the right of the
 * tool menu so it never overlaps menu content. Used to pick a state for
 * the source/destination slots in the transition creator.
 *
 * Closes on: option click, click outside, Escape.
 * Keyboard: ArrowUp/Down to navigate, Enter to confirm, Escape to dismiss.
 *
 * Anchoring strategy: the caller passes the trigger element's bounding
 * rect; we compute the position to the right of `.tool-menu-open`,
 * vertically aligned with the trigger.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export type PickerOption = {
  value: string;
  label: string;
};

type StatePickerPopoverProp = {
  options: PickerOption[];
  selectedValue: string | null;
  /** The rect of the element that opened this popover (for vertical alignment). */
  anchorRect: DOMRect | null;
  onPick: (value: string) => void;
  onClose: () => void;
};

export function StatePickerPopover({
  options,
  selectedValue,
  anchorRect,
  onPick,
  onClose,
}: StatePickerPopoverProp) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(() => {
    const idx = options.findIndex((o) => o.value === selectedValue);
    return idx >= 0 ? idx : 0;
  });
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  // Position the popover to the right of the tool menu, vertically aligned
  // with the trigger anchor. Clamped to stay within the viewport.
  useLayoutEffect(() => {
    if (!anchorRect) return;
    const menu = document.querySelector('.tool-menu-open');
    const menuRect = menu?.getBoundingClientRect();
    const left = (menuRect?.right ?? anchorRect.right) + 8;
    let top = anchorRect.top;
    const estimatedHeight = Math.min(240, options.length * 30 + 16);
    const overflow = top + estimatedHeight - window.innerHeight + 8;
    if (overflow > 0) top -= overflow;
    if (top < 8) top = 8;
    setPos({ top, left });
  }, [anchorRect, options.length]);

  // Close on Escape and click-outside.
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (popoverRef.current?.contains(target)) return;
      // Canvas state nodes that are currently pickable count as a valid
      // pick path — let the state node's own click handler dispatch the
      // pick action; closing here would race-cancel that pick before it
      // could fire.
      if (target.closest?.('.state-node-pickable')) return;
      onClose();
    }
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // Auto-focus the popover so arrow keys work immediately.
  useEffect(() => {
    popoverRef.current?.focus();
  }, []);

  function handleListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((i) => (i + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((i) => (i - 1 + options.length) % options.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlightedIndex(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const opt = options[highlightedIndex];
      if (opt) onPick(opt.value);
    }
  }

  return (
    <div
      ref={popoverRef}
      className="state-picker-popover"
      role="listbox"
      tabIndex={-1}
      onKeyDown={handleListKeyDown}
      style={{ top: pos.top, left: pos.left }}
    >
      {options.map((option, index) => {
        const isSelected = option.value === selectedValue;
        const isHighlighted = index === highlightedIndex;
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={[
              'state-picker-popover-option',
              isHighlighted ? 'highlighted' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => onPick(option.value)}
            onMouseEnter={() => setHighlightedIndex(index)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
