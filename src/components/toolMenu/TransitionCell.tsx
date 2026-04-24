/**
 * TransitionCell Component
 *
 * One cell in the transition table. Encapsulates the custom dropdown that
 * replaces the native <select> — we control popup position so it doesn't
 * overlap neighbouring cells.
 *
 * Behaviour:
 * - Trigger button shows the current destination (or '—' for missing).
 * - Click trigger or press Enter/Space when focused → popover opens below.
 * - Popover lists all destination options + the empty option.
 * - Arrow Up/Down navigate options, Enter selects, Escape closes.
 * - Click outside closes without changes.
 *
 * Keyboard navigation between cells (Arrow Left/Right/Up/Down across the
 * grid) is handled by the parent TransitionEditor via key events on the
 * containing table.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const EMPTY_VALUE = '__none__';

type Option = {
  /** The value: a state ID as a string, or EMPTY_VALUE for the "no transition" option. */
  value: string;
  /** Display label (e.g. "q0" or "—"). */
  label: string;
};

type TransitionCellProp = {
  /** The currently-selected option value. */
  value: string;
  /** All choices the user can pick (already including the empty option). */
  options: Option[];
  /** Whether to render this cell as missing (no current transition). */
  isMissing: boolean;
  /** Whether this cell is the active highlight target of a notification. */
  isHighlighted: boolean;
  /** aria-label describing this cell to screen readers. */
  ariaLabel: string;
  /** Whether the cell is the currently roving-focused cell in the table. */
  isRovingFocused: boolean;
  /** Called when the user picks a new option. */
  onChange: (newValue: string) => void;
  /** Called when the cell receives focus (so the parent can update the roving cursor). */
  onFocus: () => void;
};

export function TransitionCell({
  value,
  options,
  isMissing,
  isHighlighted,
  ariaLabel,
  isRovingFocused,
  onChange,
  onFocus,
}: TransitionCellProp) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === value)
    )
  );

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; minWidth: number }>({
    top: 0,
    left: 0,
    minWidth: 0,
  });

  // Compute popover position whenever it opens or the trigger moves. Using
  // fixed positioning so the popover can escape the table's overflow:auto
  // wrapper without being clipped.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPopoverPos({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
    });
  }, [isOpen]);

  // Close on click-outside and on Escape.
  useEffect(() => {
    if (!isOpen) return;
    function handleDocClick(event: MouseEvent) {
      const target = event.target as Node;
      if (
        triggerRef.current && triggerRef.current.contains(target)
      ) return;
      if (popoverRef.current && popoverRef.current.contains(target)) return;
      setIsOpen(false);
    }
    function handleDocKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleDocKey);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleDocKey);
    };
  }, [isOpen]);

  // When the popover opens, sync the highlight to the current value so
  // arrow keys start from the right place.
  useEffect(() => {
    if (isOpen) {
      const currentIndex = options.findIndex((option) => option.value === value);
      setHighlightedIndex(currentIndex >= 0 ? currentIndex : 0);
    }
  }, [isOpen, options, value]);

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(true);
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
        setIsOpen(false);
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

  // Auto-focus the option list when the popover opens so arrow keys work
  // immediately.
  useEffect(() => {
    if (isOpen && popoverRef.current) {
      popoverRef.current.focus();
    }
  }, [isOpen]);

  const triggerLabel = options.find((option) => option.value === value)?.label ?? '—';
  const cellClass = [
    'transition-table-cell',
    isMissing ? 'transition-table-cell-missing' : '',
    isHighlighted ? 'pulse-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <td className={cellClass}>
      <button
        ref={triggerRef}
        type="button"
        className="transition-table-select"
        onClick={() => setIsOpen((current) => !current)}
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
            minWidth: Math.max(popoverPos.minWidth, 80),
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
                  setIsOpen(false);
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
    </td>
  );
}
