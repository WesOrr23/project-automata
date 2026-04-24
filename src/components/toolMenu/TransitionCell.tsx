/**
 * TransitionCell Component
 *
 * One cell in the transition table. Shows the current destination as a
 * trigger button; when "active" (open), the parent renders a popover anchored
 * to a position outside the menu bar.
 *
 * Open/closed state is owned by the parent (TransitionEditor) via the
 * `isOpen` + `onOpenChange` props — guaranteeing only one cell is open at a
 * time without each cell racing to close itself when another is clicked.
 *
 * Keyboard interactions inside an open cell (Arrow Up/Down, Enter, Escape,
 * Home, End) are handled here. Cross-cell navigation (Arrow Left/Right/Up/
 * Down to neighbouring cells) is handled by the parent.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const EMPTY_VALUE = '__none__';

type Option = {
  value: string;
  label: string;
};

type TransitionCellProp = {
  value: string;
  options: Option[];
  isMissing: boolean;
  isHighlighted: boolean;
  ariaLabel: string;
  isRovingFocused: boolean;
  isOpen: boolean;
  onChange: (newValue: string) => void;
  onFocus: () => void;
  onOpenChange: (open: boolean) => void;
};

export function TransitionCell({
  value,
  options,
  isMissing,
  isHighlighted,
  ariaLabel,
  isRovingFocused,
  isOpen,
  onChange,
  onFocus,
  onOpenChange,
}: TransitionCellProp) {
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; minWidth: number }>({
    top: 0,
    left: 0,
    minWidth: 80,
  });

  // Compute popover position whenever it opens. Anchor to the right of the
  // tool menu (the .tool-menu-open container) so the popover never overlaps
  // anything inside the menu. Vertically align with the trigger.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const triggerRect = trigger.getBoundingClientRect();
    const menu = trigger.closest('.tool-menu-open');
    const menuRect = menu?.getBoundingClientRect();
    const left = (menuRect?.right ?? triggerRect.right) + 8;
    let top = triggerRect.top;
    // If the popover would overflow the bottom of the viewport, shift up.
    const estimatedHeight = Math.min(240, options.length * 30 + 16);
    const overflow = top + estimatedHeight - window.innerHeight + 8;
    if (overflow > 0) top -= overflow;
    if (top < 8) top = 8;
    setPopoverPos({ top, left, minWidth: 80 });
  }, [isOpen, options.length]);

  // Close on click-outside and on Escape.
  useEffect(() => {
    if (!isOpen) return;
    function handleDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      onOpenChange(false);
    }
    function handleDocKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleDocKey);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleDocKey);
    };
  }, [isOpen, onOpenChange]);

  // Sync the highlight to the current value when the popover opens.
  useEffect(() => {
    if (isOpen) {
      const currentIndex = options.findIndex((option) => option.value === value);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [isOpen, options, value]);

  // Focus the popover when it opens so arrow keys work immediately.
  useEffect(() => {
    if (isOpen && popoverRef.current) {
      popoverRef.current.focus();
    }
  }, [isOpen]);

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    // Per the navigation contract:
    //   navigation mode (cell focused, popover closed) → arrows move cells
    //   edit mode      (popover open)                  → arrows move options
    // Only Enter / Space transitions from navigation → edit.
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onOpenChange(true);
    }
  }

  function handleOptionListKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((current) => (current + 1) % options.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => (current - 1 + options.length) % options.length);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const selected = options[highlightedIndex];
      if (selected) {
        onChange(selected.value);
        onOpenChange(false);
        triggerRef.current?.focus();
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      setHighlightedIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setHighlightedIndex(options.length - 1);
    }
  }

  const triggerLabel = options.find((option) => option.value === value)?.label ?? '—';
  const cellClass = [
    'transition-grid-cell',
    isMissing ? 'transition-grid-cell-missing' : '',
    isHighlighted ? 'pulse-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cellClass} role="gridcell">
      <button
        ref={triggerRef}
        type="button"
        className="transition-grid-trigger"
        onClick={() => onOpenChange(!isOpen)}
        onFocus={onFocus}
        onKeyDown={handleTriggerKeyDown}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        tabIndex={isRovingFocused ? 0 : -1}
      >
        {triggerLabel}
      </button>
      {isOpen && (
        <div
          ref={popoverRef}
          className="transition-cell-popover"
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleOptionListKeyDown}
          style={{
            top: popoverPos.top,
            left: popoverPos.left,
            minWidth: popoverPos.minWidth,
          }}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isHighlightedOption = index === highlightedIndex;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={[
                  'transition-cell-popover-option',
                  isHighlightedOption ? 'highlighted' : '',
                  option.value === EMPTY_VALUE ? 'empty' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  onChange(option.value);
                  onOpenChange(false);
                  triggerRef.current?.focus();
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
