import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { ToolMenuState, ToolTabID, toolTabs } from './types';

type ToolMenuProp = {
    state: ToolMenuState;
    onHoverEvent: () => void;
    onHoverLeave: () => void;
    onTabClick: (tab: ToolTabID) => void;
    onCollapse: () => void;
    configContent: ReactNode;
    editContent: ReactNode;
    simulateContent: ReactNode;
};

/**
 * ToolMenu — single architecture, three sizes.
 *
 * The menu always renders the same three tab rows; the container
 * width controls how much of each row is visible. COLLAPSED clips
 * everything past the icon; EXPANDED reveals the labels; OPEN reveals
 * the labels AND grows vertically to host the active tab's content.
 *
 * Vertical center of the menu is pinned to the viewport center, so
 * height changes are symmetric about that axis (no top-anchor jump).
 *
 * Two-stage OPEN transition: width animates first, max-height delayed
 * — see `.tool-menu-open` in index.css for the per-state transition
 * declarations that drive the effect.
 */
export function ToolMenu({
    state,
    onHoverEvent,
    onHoverLeave,
    onTabClick,
    onCollapse,
    configContent,
    editContent,
    simulateContent
}: ToolMenuProp) {
    function contentFor(tabId: ToolTabID) : ReactNode {
        switch(tabId) {
            case 'CONFIG':  return configContent;
            case 'EDIT':    return editContent;
            case 'SIMULATE':return simulateContent;
            default:
                const _exhaustive: never = tabId;
                return _exhaustive;
        }
    }

    const modeClass =
        state.mode === 'COLLAPSED' ? 'tool-menu-collapsed'
      : state.mode === 'EXPANDED'  ? 'tool-menu-expanded'
      :                              'tool-menu-open';

    // Hover handlers only meaningful in COLLAPSED → EXPANDED transition.
    // OPEN mode pins the menu in place; no hover-driven shrink.
    const onMouseEnter = state.mode === 'COLLAPSED' ? onHoverEvent : undefined;
    const onMouseLeave = state.mode === 'EXPANDED'  ? onHoverLeave : undefined;

    const activeTab = state.mode === 'OPEN' ? state.activeTab : null;

    return (
        <aside
            className={`tool-menu ${modeClass}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {state.mode === 'OPEN' && (
                <button
                    type="button"
                    className="tool-menu-back"
                    onClick={onCollapse}
                    aria-label="Collapse menu"
                >
                    <ChevronLeft size={14} />
                    <span className="tool-menu-row-label">Collapse</span>
                </button>
            )}
            {toolTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;

                // The active row is wrapped in a card containing both the
                // header (a non-interactive row) and the content panel
                // beneath. Compact rows (and rows in non-OPEN modes) are
                // standalone buttons.
                if (isActive) {
                    return (
                        <div key={tab.id} className="tool-menu-active-card">
                            <div className="tool-menu-row active" aria-label={`${tab.label} (active)`}>
                                <Icon size={20} />
                                <span className="tool-menu-row-label">{tab.label}</span>
                            </div>
                            <div className="tool-menu-active-content">
                                {contentFor(tab.id)}
                            </div>
                        </div>
                    );
                }
                return (
                    <button
                        key={tab.id}
                        type="button"
                        className="tool-menu-row"
                        onClick={() => onTabClick(tab.id)}
                        aria-label={tab.label}
                    >
                        <Icon size={20} />
                        <span className="tool-menu-row-label">{tab.label}</span>
                    </button>
                );
            })}
        </aside>
    );
}
