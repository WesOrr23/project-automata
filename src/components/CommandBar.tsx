/**
 * CommandBar — unified top-center pill for all command-tier UI.
 *
 * Variant B of the menu-architecture brainstorm: rather than scattering
 * file ops, undo/redo, and operations as separate floating widgets, we
 * collapse them into a single horizontal bar pinned at top-center. The
 * bar has three logical segments:
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  Untitled •  📄 📂 💾 ⋯  │  ↶ ↷  Convert to DFA  │  (sim slot) │
 *   │      file (always)        │       EDIT only       │  SIM only   │
 *   └─────────────────────────────────────────────────────────────────┘
 *
 * Mode-specific segments mount/unmount via AnimatePresence, animating
 * width:auto ↔ 0 plus opacity so the bar morphs smoothly between modes
 * rather than snapping. Vertical 1px dividers separate segments using
 * --border-subtle.
 *
 * Visual language matches the prior UndoRedoControls pill (background,
 * border, shadow, blur) so users who knew the old pill recognize the
 * new bar as the same kind of floating affordance — just bigger and
 * smarter.
 *
 * The ⋯ button opens an anchored popover hanging directly below the
 * bar with Save As + Recents. Closes on outside click and on Escape.
 *
 * Trade-off vs scattered satellites (Scheme C in the brainstorm):
 *   + Single discoverable location for all command-tier controls.
 *   + Mode morphs feel like one bar adapting, not many widgets popping.
 *   - More chrome at the top edge across all modes.
 *   - Less lateral breathing room for future mode-specific controls; if
 *     a mode grows many commands, the bar will need to grow wider.
 */

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { FilePlus, FolderOpen, Save, MoreHorizontal, Undo2, Redo2, X } from 'lucide-react';
// Note: Convert-to-DFA was briefly hosted here in the initial Variant B
// shipping. Pulled back out per Wes's feedback: the bar is for COMMON
// command-tier actions (file + history). Operation-tier transformations
// like Convert / Minimize / Equivalence are EDIT-mode-specific tools and
// belong in the Edit panel (or its own future Operations widget).
import type { RecentEntry } from '../files/recentsStore';

// Cheap platform detection — same approach the old UndoRedoControls
// used. The result only drives tooltip glyphs, so a wrong guess is
// purely cosmetic.
const isMac =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modGlyph = isMac ? '\u2318' : 'Ctrl';
const shiftGlyph = isMac ? '\u21e7' : 'Shift+';

export type CommandBarAppMode = 'IDLE' | 'EDITING' | 'SIMULATING';

type CommandBarProp = {
  // ─── App mode (drives segment visibility) ───
  appMode: CommandBarAppMode;

  // ─── File segment (always visible) ───
  currentName: string | null;
  isDirty: boolean;
  recents: ReadonlyArray<RecentEntry>;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenRecent: (id: string) => void;
  onForgetRecent: (id: string) => void;

  // ─── Edit segment (EDIT only) ───
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
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

// Shared motion config for segment morph: width animates from 0 to
// natural-content alongside opacity. 0.25s matches the prior
// UndoRedoControls duration so the visual cadence carries over.
const segmentMotion = {
  initial: { opacity: 0, width: 0 },
  animate: { opacity: 1, width: 'auto' as const },
  exit: { opacity: 0, width: 0 },
  transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] },
};

export function CommandBar({
  appMode,
  currentName,
  isDirty,
  recents,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onOpenRecent,
  onForgetRecent,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: CommandBarProp) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverContainerRef = useRef<HTMLDivElement | null>(null);

  // Close the popover on outside click and on Escape. The container
  // ref scopes the "is this click inside?" check to the file segment,
  // so clicking elsewhere on the bar (e.g. an undo button) also
  // dismisses — that's the right behavior; a user reaching for a
  // different command shouldn't be blocked by the popover.
  useEffect(() => {
    if (!popoverOpen) return;
    function handlePointerDown(event: MouseEvent) {
      const node = popoverContainerRef.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) {
        setPopoverOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [popoverOpen]);

  return (
    <div className="command-bar" role="toolbar" aria-label="Command bar">
      {/* ─── File segment — always visible ─── */}
      <div
        className="command-bar-segment command-bar-segment-file"
        ref={popoverContainerRef}
      >
        <span className="command-bar-filename" title={currentName ?? 'Untitled'}>
          {currentName ?? 'Untitled'}
          {isDirty && (
            <span className="command-bar-dirty-dot" aria-label="Unsaved changes" title="Unsaved changes">
              •
            </span>
          )}
        </span>
        <button
          type="button"
          className="command-bar-button"
          onClick={onNew}
          aria-label="New"
          title={`New (${modGlyph}N)`}
        >
          <FilePlus size={16} />
        </button>
        <button
          type="button"
          className="command-bar-button"
          onClick={onOpen}
          aria-label="Open"
          title={`Open (${modGlyph}O)`}
        >
          <FolderOpen size={16} />
        </button>
        <button
          type="button"
          className="command-bar-button"
          onClick={onSave}
          aria-label="Save"
          title={`Save (${modGlyph}S)`}
        >
          <Save size={16} />
        </button>
        <button
          type="button"
          className="command-bar-button"
          onClick={() => setPopoverOpen((v) => !v)}
          aria-label="More file actions"
          aria-haspopup="menu"
          aria-expanded={popoverOpen}
          title="More file actions"
        >
          <MoreHorizontal size={16} />
        </button>

        {popoverOpen && (
          <div className="command-bar-popover" role="menu">
            <div className="command-bar-popover-section">
              <button
                type="button"
                className="command-bar-popover-item"
                onClick={() => {
                  setPopoverOpen(false);
                  onSaveAs();
                }}
                title={`Save As (${modGlyph}${shiftGlyph}S)`}
              >
                <Save size={14} />
                <span>Save As…</span>
              </button>
            </div>
            <div className="command-bar-popover-section">
              <span className="command-bar-popover-label">Recents</span>
              {recents.length === 0 ? (
                <div className="command-bar-popover-recents-empty">No recent files</div>
              ) : (
                recents.map((entry) => (
                  <div key={entry.id} className="command-bar-popover-recent">
                    <button
                      type="button"
                      className="command-bar-popover-recent-open"
                      onClick={() => {
                        setPopoverOpen(false);
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
          </div>
        )}
      </div>

      {/* ─── EDIT segment — undo/redo + ops ─── */}
      <AnimatePresence initial={false}>
        {appMode === 'EDITING' && (
          <motion.div
            key="edit-segment"
            className="command-bar-segment"
            // Wrapper used to host the divider + content; both fade in
            // together. Using `motion.div` with width:auto requires
            // overflow:hidden (set on .command-bar-segment) so content
            // doesn't poke out during the collapse.
            {...segmentMotion}
          >
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

      {/* ─── SIMULATE segment — reserved, currently empty ───
          Intentionally not rendered when nothing populates it. When
          future SIMULATE-tier commands land (replay scrubber, jump-to,
          etc.) they slot in here behind their own AnimatePresence so
          the bar morphs the same way it does for EDIT. */}
    </div>
  );
}
