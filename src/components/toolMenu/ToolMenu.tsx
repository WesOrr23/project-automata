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
        }
    }
    if (state.mode === 'COLLAPSED') {
        return  (
            <aside className="tool-menu tool-menu-collapsed" onMouseEnter={onHoverEvent}>
                {toolTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button key={tab.id} className="tool-menu-icon" aria-label={tab.label}>
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
                    return (
                        <div 
                            key={tab.id} 
                            className={`tool-menu-card ${isActive ? 'active' : 'compact'}`}
                            onClick={isActive ? undefined : () => onTabClick(tab.id)}>
                            <div
                                className='tool-menu-card-header'>
                                    <Icon size={20}/>
                                    <span>{tab.label}</span>
                            </div>
                            {isActive && (
                                <div className="tool-menu-card-content">{contentFor(tab.id)}</div>
                            )}
                        </div>
                    );
                })}
            </aside>
        )
    }
}