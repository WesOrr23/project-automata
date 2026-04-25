import { Fragment, type ReactNode } from 'react';
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
 * Same DOM shape across modes: three rows, one per tab. Container
 * width controls how much of each row is visible. COLLAPSED clips
 * past the icon; EXPANDED reveals the labels; OPEN reveals the
 * labels AND renders the active tab's content as a SIBLING beneath
 * its row.
 *
 * Visual unity: even though the active row and its content panel are
 * DOM siblings, they're styled to look like one card — matching
 * borders + flattened inner corners on the row's bottom and the
 * panel's top so the seam is invisible.
 *
 * Collapse affordance lives at the right edge of the active row's
 * header (only in OPEN mode). No separate top-of-menu back button.
 *
 * Vertical center pinned via translateY(-50%) so OPEN's height
 * growth — including tab-switch resizes — is symmetric about the
 * screen center.
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
            {toolTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeTab;
                return (
                    <Fragment key={tab.id}>
                        {isActive ? (
                            // Active row in OPEN mode: a div (not a button) so
                            // we can nest a collapse button on the right without
                            // invalid button-in-button markup.
                            <div className="tool-menu-row active" aria-label={`${tab.label} (active)`}>
                                <Icon size={20} />
                                <span className="tool-menu-row-label">{tab.label}</span>
                                <button
                                    type="button"
                                    className="tool-menu-row-collapse"
                                    onClick={onCollapse}
                                    aria-label="Collapse menu"
                                    title="Collapse menu"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="tool-menu-row"
                                onClick={() => onTabClick(tab.id)}
                                aria-label={tab.label}
                            >
                                <Icon size={20} />
                                <span className="tool-menu-row-label">{tab.label}</span>
                            </button>
                        )}
                        {isActive && state.mode === 'OPEN' && (
                            // Keyed on tab.id so React unmounts the old content
                            // and mounts the new on tab switch — that lets the
                            // @starting-style fade fire for every switch, not
                            // just the first OPEN.
                            <div
                                key={`content-${tab.id}`}
                                className="tool-menu-active-content"
                            >
                                {contentFor(tab.id)}
                            </div>
                        )}
                    </Fragment>
                );
            })}
        </aside>
    );
}
