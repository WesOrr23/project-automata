/**
 * TransitionGrid Component
 *
 * Pure CSS-Grid layout for the transition function (no <table>).
 *
 * Layout (2 rows x 2 columns of grid areas):
 *
 *   ┌─────────┬───────────────────┐
 *   │ corner  │  col-headers      │   row 1 (auto height)
 *   ├─────────┼───────────────────┤
 *   │ row-    │  data             │   row 2 (1fr)
 *   │ headers │  (the cells)      │
 *   └─────────┴───────────────────┘
 *      auto              1fr
 *
 * Each of `col-headers`, `row-headers`, and `data` is its own scroll
 * container. The data area scrolls in both directions; on every scroll we
 * mirror its scrollLeft into col-headers and its scrollTop into
 * row-headers. The headers themselves use `overflow: hidden` so they don't
 * show scrollbars but follow the data.
 *
 * Why CSS Grid instead of a <table>?
 *  - No table-layout quirks, no border-collapse vs sticky conflicts.
 *  - Each section can have its own padding/margin/gap rules without
 *    fighting the others.
 *  - Z-index is straightforward — every section is its own grid item in
 *    the same stacking context.
 *
 * The fade overlays (gradient strips just inside each header) are
 * absolutely positioned within the shell so they cover the join between
 * header and data without scrolling.
 */

import { useLayoutEffect, useRef, useState } from 'react';
import { TransitionCell } from './TransitionCell';

const EMPTY_VALUE = '__none__';

type Option = { value: string; label: string };

type CellSpec = {
  value: string;
  isMissing: boolean;
  isHighlighted: boolean;
  ariaLabel: string;
  onChange: (newValue: string) => void;
};

type TransitionGridProp = {
  rowIds: number[];
  columnSymbols: string[];
  rowLabel: (stateId: number) => string;
  cellOptions: Option[];
  cellAt: (rowIndex: number, colIndex: number) => CellSpec;
  rovingFocus: { row: number; col: number };
  openCell: { row: number; col: number } | null;
  onCellFocus: (row: number, col: number) => void;
  onOpenChange: (row: number, col: number, open: boolean) => void;
  onArrowNavigate: (event: React.KeyboardEvent) => void;
};

export function TransitionGrid({
  rowIds,
  columnSymbols,
  rowLabel,
  cellOptions,
  cellAt,
  rovingFocus,
  openCell,
  onCellFocus,
  onOpenChange,
  onArrowNavigate,
}: TransitionGridProp) {
  const dataRef = useRef<HTMLDivElement>(null);
  const colHeadersRef = useRef<HTMLDivElement>(null);
  const rowHeadersRef = useRef<HTMLDivElement>(null);
  const cornerRef = useRef<HTMLDivElement>(null);
  const rowHeaderCellRef = useRef<HTMLDivElement>(null);

  // Measured dimensions — written to CSS variables so the absolutely-positioned
  // fade overlays can sit just inside the headers regardless of font/padding.
  const [headerH, setHeaderH] = useState(28);
  const [rowHeaderW, setRowHeaderW] = useState(36);

  useLayoutEffect(() => {
    const cornerH = cornerRef.current?.getBoundingClientRect().height;
    const rowW = rowHeaderCellRef.current?.getBoundingClientRect().width;
    if (cornerH && cornerH > 0) setHeaderH(cornerH);
    if (rowW && rowW > 0) setRowHeaderW(rowW);
  }, [rowIds.length, columnSymbols.length]);

  // Mirror data scroll into the two header strips.
  function handleDataScroll(event: React.UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    if (colHeadersRef.current) {
      colHeadersRef.current.scrollLeft = target.scrollLeft;
    }
    if (rowHeadersRef.current) {
      rowHeadersRef.current.scrollTop = target.scrollTop;
    }
  }

  // Inline style for the inner data grid: defines the columns / rows so all
  // cells line up.
  const dataInnerStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columnSymbols.length}, minmax(48px, 1fr))`,
    gridAutoRows: 'minmax(28px, auto)',
    gap: 'var(--space-1)',
    padding: 'var(--space-1)',
  } as const;

  const colHeadersInnerStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columnSymbols.length}, minmax(48px, 1fr))`,
    gap: 'var(--space-1)',
    padding: 'var(--space-1)',
  } as const;

  const rowHeadersInnerStyle = {
    display: 'grid',
    gridAutoRows: 'minmax(28px, auto)',
    gap: 'var(--space-1)',
    padding: 'var(--space-1)',
  } as const;

  const shellStyle = {
    ['--transition-grid-header-h' as string]: `${headerH}px`,
    ['--transition-grid-row-header-w' as string]: `${rowHeaderW}px`,
  };

  return (
    <div className="transition-grid-shell" style={shellStyle}>
      <div className="transition-grid" role="grid" onKeyDown={onArrowNavigate}>
        {/* Top-left corner — empty. */}
        <div ref={cornerRef} className="transition-grid-corner" aria-hidden="true" />

        {/* Top header strip — scrolls horizontally with data. */}
        <div ref={colHeadersRef} className="transition-grid-col-headers">
          <div style={colHeadersInnerStyle}>
            {columnSymbols.map((symbol) => (
              <div key={symbol} className="transition-grid-col-header" role="columnheader">
                {symbol}
              </div>
            ))}
          </div>
        </div>

        {/* Left header strip — scrolls vertically with data. */}
        <div ref={rowHeadersRef} className="transition-grid-row-headers">
          <div style={rowHeadersInnerStyle}>
            {rowIds.map((stateId, rowIndex) => (
              <div
                key={stateId}
                ref={rowIndex === 0 ? rowHeaderCellRef : null}
                className="transition-grid-row-header"
                role="rowheader"
              >
                {rowLabel(stateId)}
              </div>
            ))}
          </div>
        </div>

        {/* Data area — the only one with visible scrollbars. */}
        <div
          ref={dataRef}
          className="transition-grid-data"
          onScroll={handleDataScroll}
        >
          <div style={dataInnerStyle}>
            {rowIds.flatMap((_stateId, rowIndex) =>
              columnSymbols.map((_symbol, colIndex) => {
                const spec = cellAt(rowIndex, colIndex);
                const isOpen =
                  openCell !== null &&
                  openCell.row === rowIndex &&
                  openCell.col === colIndex;
                const isRovingFocused =
                  rovingFocus.row === rowIndex && rovingFocus.col === colIndex;
                return (
                  <TransitionCell
                    key={`${rowIndex}-${colIndex}`}
                    value={spec.value}
                    options={cellOptions}
                    isMissing={spec.isMissing}
                    isHighlighted={spec.isHighlighted}
                    ariaLabel={spec.ariaLabel}
                    isRovingFocused={isRovingFocused}
                    isOpen={isOpen}
                    onChange={spec.onChange}
                    onFocus={() => onCellFocus(rowIndex, colIndex)}
                    onOpenChange={(open) => onOpenChange(rowIndex, colIndex, open)}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Fade overlays — gradient strips inside each header. */}
      <div
        className="transition-grid-fade transition-grid-fade-right-of-row"
        aria-hidden="true"
      />
      <div
        className="transition-grid-fade transition-grid-fade-below-col"
        aria-hidden="true"
      />
    </div>
  );
}

export { EMPTY_VALUE };
