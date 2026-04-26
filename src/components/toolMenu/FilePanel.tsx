/**
 * FilePanel — content for the FILE tab in the tool menu.
 *
 * Three sections: action buttons (New / Open / Save / Save As), the
 * current-file indicator (name + dirty marker), and the recents list.
 *
 * No keyboard shortcuts are wired here — those live in
 * useFileShortcuts so they work even when the FILE tab isn't open.
 */

import { FilePlus, FolderOpen, Save, X } from 'lucide-react';
import { RecentEntry } from '../../files/recentsStore';

type FilePanelProp = {
  currentName: string | null;
  isDirty: boolean;
  recents: ReadonlyArray<RecentEntry>;
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpenRecent: (id: string) => void;
  onForgetRecent: (id: string) => void;
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

export function FilePanel({
  currentName,
  isDirty,
  recents,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onOpenRecent,
  onForgetRecent,
}: FilePanelProp) {
  return (
    <div className="file-panel">
      <div className="file-panel-current">
        <span className="label">Current</span>
        <div className="file-panel-current-name">
          {currentName ?? 'Untitled'}
          {isDirty && (
            <span className="file-panel-dirty-dot" title="Unsaved changes">
              •
            </span>
          )}
        </div>
      </div>

      <div className="file-panel-actions">
        <button className="btn" type="button" onClick={onNew} title="New (⌘N)">
          <FilePlus size={14} />
          <span>New</span>
        </button>
        <button className="btn" type="button" onClick={onOpen} title="Open (⌘O)">
          <FolderOpen size={14} />
          <span>Open</span>
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={onSave}
          title="Save (⌘S)"
        >
          <Save size={14} />
          <span>Save</span>
        </button>
        <button className="btn" type="button" onClick={onSaveAs} title="Save As (⌘⇧S)">
          <Save size={14} />
          <span>Save As</span>
        </button>
      </div>

      <div className="file-panel-recents">
        <span className="label">Recents</span>
        {recents.length === 0 ? (
          <div className="file-panel-recents-empty">No recent files</div>
        ) : (
          <ul className="file-panel-recents-list">
            {recents.map((entry) => (
              <li key={entry.id} className="file-panel-recents-item">
                <button
                  type="button"
                  className="file-panel-recents-open"
                  onClick={() => onOpenRecent(entry.id)}
                  title={`Open ${entry.name}`}
                >
                  <span className="file-panel-recents-name">{entry.name}</span>
                  <span className="file-panel-recents-meta">
                    {formatRelative(entry.openedAt)}
                  </span>
                </button>
                <button
                  type="button"
                  className="file-panel-recents-forget"
                  onClick={() => onForgetRecent(entry.id)}
                  aria-label={`Forget ${entry.name}`}
                  title="Remove from recents"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
