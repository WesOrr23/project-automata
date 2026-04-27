/**
 * OperationsWidget — floating top-center pill (sibling of CommandBar)
 * for operation-tier transformations: convert, minimize, complement,
 * etc. Visible only in EDIT mode; collapses out via AnimatePresence
 * when the user leaves EDIT.
 *
 * Visual: single icon button (Wand2). Click → categorized popover
 * anchored below, with sections (Conversions / Analysis / etc.) and
 * per-item enable/disable + tooltip. Items dispatch their handler and
 * close the popover.
 *
 * Why a categorized popover rather than a row of inline buttons:
 * operations are NICHE (convert + minimize + complement is already 3,
 * and equivalence/regex/image-export will follow). Inline would push
 * the bar wide; a popover scales without claiming horizontal real
 * estate at rest.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Wand2 } from 'lucide-react';

export type OperationsItem = {
  id: string;
  label: string;
  /** Optional one-line hint shown beneath the label (italic, secondary). */
  hint?: string;
  enabled: boolean;
  /** Tooltip / disabled-explanation shown via title attribute. */
  title?: string;
  onClick: () => void;
};

export type OperationsCategory = {
  id: string;
  label: string;
  items: ReadonlyArray<OperationsItem>;
};

type OperationsWidgetProp = {
  /** Whether the widget is rendered at all. EDIT mode → true. */
  visible: boolean;
  categories: ReadonlyArray<OperationsCategory>;
};

export function OperationsWidget({ visible, categories }: OperationsWidgetProp) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Outside-click + Escape close. Same idiom as the CommandBar ⋯
  // popover so the two feel consistent.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const node = containerRef.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // When the widget unmounts (leaving EDIT mode), force the popover
  // closed so reopening doesn't surprise the user with stale state.
  useEffect(() => {
    if (!visible) setOpen(false);
  }, [visible]);

  // Filter out empty categories so the popover never shows a header
  // with no items below it.
  const populated = categories.filter((c) => c.items.length > 0);

  return (
    <AnimatePresence mode="popLayout">
      {visible && (
        <motion.div
          ref={containerRef}
          className="operations-widget"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
        >
          <button
            type="button"
            className="operations-widget-button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Operations"
            aria-haspopup="menu"
            aria-expanded={open}
            title="Operations (convert, minimize, complement…)"
          >
            <Wand2 size={16} />
          </button>

          {open && (
            <div className="operations-widget-popover" role="menu">
              {populated.length === 0 ? (
                <div className="operations-widget-empty">
                  No operations available for the current automaton.
                </div>
              ) : (
                populated.map((cat) => (
                  <OperationsSection
                    key={cat.id}
                    category={cat}
                    onPick={() => setOpen(false)}
                  />
                ))
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OperationsSection({
  category,
  onPick,
}: {
  category: OperationsCategory;
  onPick: () => void;
}): ReactNode {
  return (
    <div className="operations-widget-section">
      <span className="operations-widget-section-label">{category.label}</span>
      {category.items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className="operations-widget-item"
          disabled={!item.enabled}
          title={item.title}
          onClick={() => {
            onPick();
            item.onClick();
          }}
        >
          <span className="operations-widget-item-label">{item.label}</span>
          {item.hint && (
            <span className="operations-widget-item-hint">{item.hint}</span>
          )}
        </button>
      ))}
    </div>
  );
}
