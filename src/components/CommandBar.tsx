/**
 * CommandBar — unified top-center pill for all command-tier UI.
 *
 * Layout (left → right):
 *
 *   FILE segment (always visible)
 *     ▸ filename (click to rename inline) + dirty dot
 *     ▸ [📂 File ▾]  — single dropdown with: New, Open, Save,
 *       Save As, divider, Recents. Keyboard shortcuts hit the
 *       actions directly without opening the menu. (Show tour
 *       lives on the canvas's HelpCircle button next to the zoom
 *       controls — no longer in this menu.)
 *
 *   HISTORY segment (visible in DEFINING / EDITING; always present
 *     in those stages, buttons are disabled when their stack is empty)
 *     ▸ [↶ Undo]  [↷ Redo]
 *     Hidden entirely in SIMULATING — undo targets structure,
 *     simulate targets behavior; mixing them risks editing the FA
 *     mid-run.
 *
 *   EDIT segment (visible only when appMode === 'EDITING')
 *     ▸ [🔧 Operations]
 *
 *   SIMULATE segment (visible only when appMode === 'SIMULATING')
 *     ▸ [🖼 Export ▾]  — popover offering PNG (raster) and SVG (vector).
 *       Lives here because exporting a snapshot is a "after I've
 *       validated the FA" moment; the simulate stage is when that
 *       validation happens.
 *
 *   SIMULATE segment (reserved; nothing renders yet)
 *
 * Mode-specific segments mount/unmount via AnimatePresence so the
 * bar morphs smoothly between modes.
 *
 * Several design choices worth noting:
 *
 *  - **Operations live in the bar** (not as a sibling widget). Wes's
 *    feedback was that one floating sibling widget is one too many;
 *    keeping all command-tier UI in a single chip is cleaner.
 *  - **Recents got promoted out of the ⋯ overflow** into a top-level
 *    button — easier to reach for the most-common file action after
 *    Save.
 *  - **Filename is inline-editable**: click to swap to an input, Enter
 *    to commit, Escape to discard. The bar grows naturally because
 *    the input auto-sizes via the hidden-span sizing trick.
 *  - **Open and Save show a loading state** (button background pulses
 *    + cursor change) while their promises are unresolved — the file
 *    dialog is async and a click with no feedback feels broken.
 *  - All popovers (Recents, ⋯, Operations) share an "exclusive open"
 *    state so opening one closes the others.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  FilePlus, FolderOpen, Save, Undo2, Redo2, X,
  History, Wrench, Image as ImageIcon, FileCode,
} from 'lucide-react';
import type { RecentEntry } from '../files/recentsStore';

const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modGlyph = isMac ? '\u2318' : 'Ctrl';
const shiftGlyph = isMac ? '\u21e7' : 'Shift+';

// Mirrors the active stage of the tool menu, plus IDLE for "menu
// collapsed, no stage active." DEFINING + EDITING (Construct) are
// treated as the "editable" stages; SIMULATING is read-only as far
// as the FA structure is concerned.
export type CommandBarAppMode = 'IDLE' | 'DEFINING' | 'EDITING' | 'SIMULATING';

export type OperationsItem = {
  id: string;
  label: string;
  hint?: string;
  enabled: boolean;
  /** Tooltip text — typically the reason an item is disabled. */
  title?: string;
  /** Optional leading icon (already-sized lucide element). Renders to
   *  the left of the label, vertically centered with it. Hint (if any)
   *  sits below, indented to align under the label. */
  icon?: ReactNode;
  onClick: () => void;
};

export type OperationsCategory = {
  id: string;
  label: string;
  items: ReadonlyArray<OperationsItem>;
};

type CommandBarProp = {
  appMode: CommandBarAppMode;

  // ─── File segment ───
  currentName: string | null;
  isDirty: boolean;
  recents: ReadonlyArray<RecentEntry>;
  onNew: () => void;
  /** Async so the bar can show a loading state while the file picker
   *  is up. The promise resolves on file pick OR cancellation. */
  onOpen: () => Promise<void>;
  onSave: () => Promise<void>;
  onSaveAs: () => Promise<void>;
  /** Save the current canvas as a .png file (rendered at 2× pixel
   *  density). The boolean arg controls whether the export gets a
   *  white background (false) or stays transparent (true). Async so
   *  the bar can show a loading state while the SVG → canvas → PNG
   *  pipeline runs. Optional so older test fixtures and tools that
   *  don't expose a canvas can omit it. */
  onExportPNG?: (transparent: boolean) => Promise<void>;
  /** Save the current canvas as a self-contained .svg file. Same
   *  transparent-background contract as onExportPNG. */
  onExportSVG?: (transparent: boolean) => void;
  onOpenRecent: (id: string) => void;
  onForgetRecent: (id: string) => void;
  /** Called when the user commits an inline filename rename. The empty
   *  string means "back to Untitled" (the field can't actually go
   *  empty — we discard those edits and stay on the prior name). */
  onRenameCurrent: (nextName: string) => void;

  // ─── Edit segment ───
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Operations menu. Items are categorized; empty categories are
   *  filtered out at render time. Pass [] to hide the wand button
   *  entirely (useful while we're still in CONFIG/SIMULATE — caller
   *  should also gate visibility on appMode). */
  operationsCategories: ReadonlyArray<OperationsCategory>;
};

function formatRelative(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const seconds = Math.max(1, Math.floor((now - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const segmentMotion = {
  initial: { opacity: 0, width: 0 },
  animate: { opacity: 1, width: 'auto' as const },
  exit: { opacity: 0, width: 0 },
  transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
};

type ActivePopover = 'file' | 'operations' | 'export' | null;

export function CommandBar({
  appMode,
  currentName,
  isDirty,
  recents,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onExportPNG,
  onExportSVG,
  onOpenRecent,
  onForgetRecent,
  onRenameCurrent,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  operationsCategories,
}: CommandBarProp) {
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [openLoading, setOpenLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveAsLoading, setSaveAsLoading] = useState(false);
  const [exportPNGLoading, setExportPNGLoading] = useState(false);
  // Transparent-background toggle, shared between PNG and SVG export.
  // Persists across popover open/close in this session (component
  // stays mounted) so the user doesn't have to re-tick every time.
  const [exportTransparent, setExportTransparent] = useState(false);

  // Inline rename state
  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameSizerRef = useRef<HTMLSpanElement | null>(null);
  const [renameWidth, setRenameWidth] = useState<number>(120);

  // Outside-click + Escape close popovers. Filename rename has its own
  // Escape handler (below) that runs first because the input owns the
  // event. Outside-click during rename also commits (via blur).
  useEffect(() => {
    if (activePopover === null) return;
    function handlePointerDown(event: MouseEvent) {
      const node = containerRef.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) {
        setActivePopover(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setActivePopover(null);
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePopover]);

  // Auto-focus + select-all when entering rename mode so the user can
  // start typing immediately.
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  // Sync the input width to its content so the bar grows/shrinks as
  // the user types. We mirror the draft into a hidden span and read
  // its rendered width.
  useLayoutEffect(() => {
    if (!renaming) return;
    const sizer = renameSizerRef.current;
    if (!sizer) return;
    const w = sizer.getBoundingClientRect().width;
    // Add a few px buffer for the cursor + caret.
    setRenameWidth(Math.max(60, Math.ceil(w) + 12));
  }, [renaming, renameDraft]);

  function startRename() {
    setActivePopover(null);
    setRenameDraft(currentName ?? '');
    setRenaming(true);
  }

  function commitRename() {
    const trimmed = renameDraft.trim();
    if (trimmed.length > 0 && trimmed !== currentName) {
      onRenameCurrent(trimmed);
    }
    setRenaming(false);
  }

  function cancelRename() {
    setRenaming(false);
  }

  async function withLoading(
    setter: (loading: boolean) => void,
    fn: () => Promise<void>
  ): Promise<void> {
    setter(true);
    try {
      await fn();
    } finally {
      setter(false);
    }
  }

  function togglePopover(target: Exclude<ActivePopover, null>) {
    setActivePopover((current) => (current === target ? null : target));
  }

  // Filter out empty operations categories so the popover never shows
  // a header with no items below it.
  const populatedOps = operationsCategories.filter((c) => c.items.length > 0);

  return (
    <div className="command-bar" role="toolbar" aria-label="Command bar" ref={containerRef}>
      {/* ─── File segment — always visible ─── */}
      <div className="command-bar-segment command-bar-segment-file">
        {renaming ? (
          <span className="command-bar-rename" style={{ width: renameWidth }}>
            <input
              ref={renameInputRef}
              type="text"
              className="command-bar-rename-input"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitRename();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelRename();
                }
              }}
              aria-label="Rename file"
            />
            {/* Hidden sizer mirrors the draft text so we can read its
                rendered width and grow the input to match. */}
            <span ref={renameSizerRef} className="command-bar-rename-sizer" aria-hidden="true">
              {renameDraft || ' '}
            </span>
          </span>
        ) : (
          <button
            type="button"
            className="command-bar-filename"
            onClick={startRename}
            title={`${currentName ?? 'Untitled'} — click to rename`}
            aria-label="Rename file"
          >
            {currentName ?? 'Untitled'}
            {isDirty && (
              <span
                className="command-bar-dirty-dot"
                aria-label="Unsaved changes"
                title="Unsaved changes"
              >
                •
              </span>
            )}
          </button>
        )}

        {/* Single File button collapses New / Open / Save / Save As /
            Recents / Show tour into one popover. Keyboard shortcuts
            (⌘N/O/S/⇧S) still hit the actions directly without going
            through the menu, so power users don't pay the extra
            click; the bar just stops being a row of mystery icons. */}
        <button
          type="button"
          className={`command-bar-button command-bar-button-text${activePopover === 'file' ? ' command-bar-button-active' : ''}${(openLoading || saveLoading || saveAsLoading) ? ' command-bar-button-loading' : ''}`}
          onClick={() => togglePopover('file')}
          aria-label="File menu"
          aria-haspopup="menu"
          aria-expanded={activePopover === 'file'}
          title="File"
        >
          <FolderOpen size={14} />
          <span>File</span>
        </button>

        {activePopover === 'file' && (
          <div className="command-bar-popover command-bar-popover-file-anchor" role="menu">
            <button
              type="button"
              className="command-bar-popover-item"
              onClick={() => {
                setActivePopover(null);
                onNew();
              }}
              title={`New (${modGlyph}N)`}
            >
              <FilePlus size={16} strokeWidth={2} />
              <span className="command-bar-popover-item-label-inline">New</span>
              <span className="command-bar-popover-item-shortcut">{modGlyph}N</span>
            </button>
            <button
              type="button"
              className={`command-bar-popover-item${openLoading ? ' command-bar-popover-item-loading' : ''}`}
              onClick={() => {
                setActivePopover(null);
                void withLoading(setOpenLoading, onOpen);
              }}
              disabled={openLoading}
              aria-busy={openLoading}
              title={`Open (${modGlyph}O)`}
            >
              <FolderOpen size={16} strokeWidth={2} />
              <span className="command-bar-popover-item-label-inline">Open…</span>
              <span className="command-bar-popover-item-shortcut">{modGlyph}O</span>
            </button>
            <button
              type="button"
              className={`command-bar-popover-item${saveLoading ? ' command-bar-popover-item-loading' : ''}`}
              onClick={() => {
                setActivePopover(null);
                void withLoading(setSaveLoading, onSave);
              }}
              disabled={saveLoading}
              aria-busy={saveLoading}
              title={`Save (${modGlyph}S)`}
            >
              <Save size={16} strokeWidth={2} />
              <span className="command-bar-popover-item-label-inline">Save</span>
              <span className="command-bar-popover-item-shortcut">{modGlyph}S</span>
            </button>
            <button
              type="button"
              className={`command-bar-popover-item${saveAsLoading ? ' command-bar-popover-item-loading' : ''}`}
              onClick={() => {
                setActivePopover(null);
                void withLoading(setSaveAsLoading, onSaveAs);
              }}
              disabled={saveAsLoading}
              aria-busy={saveAsLoading}
              title={`Save As (${modGlyph}${shiftGlyph}S)`}
            >
              <Save size={16} strokeWidth={2} />
              <span className="command-bar-popover-item-label-inline">Save As…</span>
              <span className="command-bar-popover-item-shortcut">{modGlyph}{shiftGlyph}S</span>
            </button>

            <div className="command-bar-popover-divider" role="separator" />


            <span className="command-bar-popover-label">
              <History size={12} aria-hidden="true" /> Recents
            </span>
            {recents.length === 0 ? (
              <div className="command-bar-popover-recents-empty">No recent files</div>
            ) : (
              recents.map((entry) => (
                <div key={entry.id} className="command-bar-popover-recent">
                  <button
                    type="button"
                    className="command-bar-popover-recent-open"
                    onClick={() => {
                      setActivePopover(null);
                      onOpenRecent(entry.id);
                    }}
                    title={`Open ${entry.name}`}
                  >
                    <span className="command-bar-popover-recent-name">{entry.name}</span>
                    <span className="command-bar-popover-recent-meta">
                      {formatRelative(entry.openedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="command-bar-popover-recent-forget"
                    onClick={() => onForgetRecent(entry.id)}
                    aria-label={`Forget ${entry.name}`}
                    title="Remove from recents"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}

          </div>
        )}
      </div>

      {/* ─── HISTORY segment — undo / redo. Visible in DEFINE +
            CONSTRUCT (= EDIT) regardless of whether history is
            non-empty, so the affordance is discoverable on first
            launch and the bar doesn't shift sideways the moment a
            user makes their first edit. Buttons are disabled when
            their stack is empty. Hidden entirely in SIMULATE — the
            running simulation references the current automaton, so
            undoing a structural change mid-run leaves the sim
            holding a stale snapshot. ─── */}
      <AnimatePresence initial={false}>
        {appMode !== 'SIMULATING' && appMode !== 'IDLE' && (
          <motion.div key="history-segment" className="command-bar-segment" {...segmentMotion}>
            <div className="command-bar-divider" aria-hidden="true" />
            <button
              type="button"
              className="command-bar-button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo"
              title={`Undo (${modGlyph}Z)`}
            >
              <Undo2 size={16} />
            </button>
            <button
              type="button"
              className="command-bar-button"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo"
              title={`Redo (${modGlyph}${shiftGlyph}Z)`}
            >
              <Redo2 size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── EDIT segment — operations only. Undo/redo split into
            their own stage-agnostic segment above. ─── */}
      <AnimatePresence initial={false}>
        {appMode === 'EDITING' && (
          <motion.div key="edit-segment" className="command-bar-segment" {...segmentMotion}>
            <div className="command-bar-divider" aria-hidden="true" />
            <button
              type="button"
              className={`command-bar-button command-bar-button-text${activePopover === 'operations' ? ' command-bar-button-active' : ''}`}
              onClick={() => togglePopover('operations')}
              aria-label="Tools"
              aria-haspopup="menu"
              aria-expanded={activePopover === 'operations'}
              title="Tools (convert, minimize, complement…)"
            >
              <Wrench size={14} />
              <span>Tools</span>
            </button>

            {activePopover === 'operations' && (
              <div className="command-bar-popover command-bar-popover-operations-anchor" role="menu">
                {populatedOps.length === 0 ? (
                  <div className="command-bar-popover-recents-empty">
                    No operations available for the current automaton.
                  </div>
                ) : (
                  populatedOps.map((cat) => (
                    <div key={cat.id} className="command-bar-popover-section">
                      <span className="command-bar-popover-label">{cat.label}</span>
                      {cat.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          role="menuitem"
                          className="command-bar-popover-item command-bar-popover-item-op"
                          disabled={!item.enabled}
                          title={item.title}
                          onClick={() => {
                            setActivePopover(null);
                            item.onClick();
                          }}
                        >
                          <span className="command-bar-popover-item-row">
                            {item.icon && (
                              <span className="command-bar-popover-item-icon" aria-hidden="true">
                                {item.icon}
                              </span>
                            )}
                            <span className="command-bar-popover-item-label">{item.label}</span>
                          </span>
                          {item.hint && (
                            <span className="command-bar-popover-item-hint">{item.hint}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SIMULATE segment — image export. Lives here (vs in the
            File menu) because exporting a snapshot is what the user
            does AFTER they've validated the FA in Simulate; surfacing
            it on the simulate stage matches that workflow moment.
            Single Export button with a popover offers PNG / SVG. ─── */}
      <AnimatePresence initial={false}>
        {appMode === 'SIMULATING' && (onExportPNG || onExportSVG) && (
          <motion.div key="simulate-segment" className="command-bar-segment" {...segmentMotion}>
            <div className="command-bar-divider" aria-hidden="true" />
            <button
              type="button"
              className={`command-bar-button command-bar-button-text${activePopover === 'export' ? ' command-bar-button-active' : ''}${exportPNGLoading ? ' command-bar-button-loading' : ''}`}
              onClick={() => togglePopover('export')}
              aria-label="Export"
              aria-haspopup="menu"
              aria-expanded={activePopover === 'export'}
              title="Export the current canvas as an image"
            >
              <ImageIcon size={14} />
              <span>Export</span>
            </button>

            {activePopover === 'export' && (
              <div className="command-bar-popover command-bar-popover-export-anchor" role="menu">
                {onExportPNG && (
                  <button
                    type="button"
                    role="menuitem"
                    className={`command-bar-popover-item${exportPNGLoading ? ' command-bar-popover-item-loading' : ''}`}
                    onClick={() => {
                      setActivePopover(null);
                      void withLoading(setExportPNGLoading, () => onExportPNG(exportTransparent));
                    }}
                    disabled={exportPNGLoading}
                    aria-busy={exportPNGLoading}
                    title="Save the current canvas as a PNG image"
                  >
                    <ImageIcon size={16} strokeWidth={2} />
                    <span className="command-bar-popover-item-label-inline">PNG image</span>
                  </button>
                )}
                {onExportSVG && (
                  <button
                    type="button"
                    role="menuitem"
                    className="command-bar-popover-item"
                    onClick={() => {
                      setActivePopover(null);
                      onExportSVG(exportTransparent);
                    }}
                    title="Save the current canvas as an SVG file"
                  >
                    <FileCode size={16} strokeWidth={2} />
                    <span className="command-bar-popover-item-label-inline">SVG image</span>
                  </button>
                )}

                <div className="command-bar-popover-divider" role="separator" />

                {/* Transparent-background toggle. Shared between PNG
                    and SVG. Defaults off (white background) since
                    that's what most pasted-into-slides use cases
                    want; off-by-default also matches the SVG that
                    has historically been delivered. */}
                <label
                  className="command-bar-popover-toggle"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={exportTransparent}
                    onChange={(e) => setExportTransparent(e.target.checked)}
                  />
                  <span>Transparent background</span>
                </label>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
