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
    if (state.mode === 'COLLAPSED') {
        return  (
            <aside className="tool-menu tool-menu-collapsed" onMouseEnter={onHoverEvent}>
                {toolTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.id}
                            className="tool-menu-icon"
                            aria-label={tab.label}
                            onClick={() => onTabClick(tab.id)}
                        >
                            <Icon size={20}/>
                        </button>
                    );
                })}
            </aside>
        )
    }

    if (state.mode === "EXPANDED") {
        return (
            <aside className="tool-menu tool-menu-expanded" onMouseLeave={onHoverLeave}>
                {toolTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button key={tab.id} className="tool-menu-pill" onClick={() => onTabClick(tab.id)}>
                            <Icon size={20}/>
                            <span>{tab.label}</span>
                        </button>
                    )
                })}
            </aside>
        );
    }

    if (state.mode === "OPEN") {
        return (
            <aside className="tool-menu tool-menu-open">
                <button className="tool-menu-back" onClick={onCollapse} aria-label="Collapse Menu">
                    <ChevronLeft size={16}/>
                </button>
                {toolTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = tab.id === state.activeTab;
                    // Active card is just a container (not interactive).
                    // Compact cards are buttons so keyboard users can Tab + Enter to switch.
                    if (isActive) {
                        return (
                            <div key={tab.id} className="tool-menu-card active">
                                <div className="tool-menu-card-header">
                                    <Icon size={20} />
                                    <span>{tab.label}</span>
                                </div>
                                <div className="tool-menu-card-content">{contentFor(tab.id)}</div>
                            </div>
                        );
                    }
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            className="tool-menu-card compact"
                            onClick={() => onTabClick(tab.id)}
                            aria-label={`Open ${tab.label} tab`}
                        >
                            <div className="tool-menu-card-header">
                                <Icon size={20} />
                                <span>{tab.label}</span>
                            </div>
                        </button>
                    );
                })}
            </aside>
        )
    }
}