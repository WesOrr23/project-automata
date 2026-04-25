import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
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
 * width/max-height/border-radius animate via CSS, scoped per
 * destination class so each transition has the right staging.
 *
 * The active panel content is wrapped in AnimatePresence so its
 * unmount is delayed for an exit fade. While the panel is fading
 * out, the active row keeps its styling — `displayedActiveTab` lags
 * `state.mode` until AnimatePresence's onExitComplete fires.
 *
 * The combination `.tool-menu-collapsed.tool-menu-closing-from-open`
 * gets a reversed-staging transition (max-height shrinks first, width
 * + radius shrink with a delay), mirroring the staged opening.
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

    // displayedActiveTab is the tab whose row gets active styling. It
    // tracks state.activeTab while OPEN, and lingers after state.mode
    // leaves OPEN until the panel's exit animation completes (cleared
    // by handleExitComplete). This is what keeps the active row blue
    // and the collapse button visible during the close.
    const [displayedActiveTab, setDisplayedActiveTab] = useState<ToolTabID | null>(
        state.mode === 'OPEN' ? state.activeTab : null
    );

    useEffect(() => {
        if (state.mode === 'OPEN') {
            setDisplayedActiveTab(state.activeTab);
            return;
        }
        // Outside OPEN: delay clearing displayedActiveTab through the
        // full staged close (vertical 0.45s + width 0.3s + radius 0.3s
        // = 1.05s total). Holding the value keeps the
        // `.tool-menu-closing-from-open` class applied so the
        // delayed-label-fade CSS rule remains in effect for its
        // delayed transition window.
        const timer = setTimeout(() => setDisplayedActiveTab(null), 1100);
        return () => clearTimeout(timer);
    }, [state.mode, state.mode === 'OPEN' ? state.activeTab : null]);

    // onExitComplete kept as a no-op handler — AnimatePresence has the
    // panel's exit timing built in; the displayedActiveTab clear is
    // governed by the timer above instead, since it covers the full
    // close (panel + width + radius), not just the panel exit.
    const handleExitComplete = () => {};

    const isClosingFromOpen = state.mode !== 'OPEN' && displayedActiveTab !== null;

    const modeClass =
        state.mode === 'COLLAPSED' ? 'tool-menu-collapsed'
      : state.mode === 'EXPANDED'  ? 'tool-menu-expanded'
      :                              'tool-menu-open';

    // Hover handlers only meaningful in COLLAPSED → EXPANDED transition.
    // OPEN mode pins the menu in place; no hover-driven shrink.
    const onMouseEnter = state.mode === 'COLLAPSED' ? onHoverEvent : undefined;
    const onMouseLeave = state.mode === 'EXPANDED'  ? onHoverLeave : undefined;

    return (
        <aside
            className={`tool-menu ${modeClass}${isClosingFromOpen ? ' tool-menu-closing-from-open' : ''}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {toolTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === displayedActiveTab;
                const isOpenWithThisTab = state.mode === 'OPEN' && state.activeTab === tab.id;
                return (
                    <Fragment key={tab.id}>
                        {isActive ? (
                            <div className="tool-menu-row active" aria-label={`${tab.label} (active)`}>
                                <Icon size={20} />
                                <span className="tool-menu-row-label">{tab.label}</span>
                                <button
                                    type="button"
                                    className="tool-menu-row-collapse"
                                    onClick={onCollapse}
                                    disabled={isClosingFromOpen}
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
                        <AnimatePresence onExitComplete={handleExitComplete}>
                            {isOpenWithThisTab && (
                                // Panel grows max-height from 0 to 95vh on
                                // mount with a 0.3s delay (waiting for the
                                // container's width-grow stage to finish).
                                // While at maxHeight: 0, the panel takes no
                                // layout space, so the Simulate row below it
                                // stays in place — no clipping during stage 1.
                                // On exit, panel collapses immediately (no
                                // delay): maxHeight + opacity → 0 in 0.3s,
                                // running concurrently with the container's
                                // own max-height shrink.
                                <motion.div
                                    key={`content-${tab.id}`}
                                    className="tool-menu-active-content"
                                    // height: 'auto' (vs maxHeight: '95vh') means Framer
                                    // measures the panel's natural content height and
                                    // animates to exactly that. With maxHeight: 95vh
                                    // (~756px) and content ~400px, the panel hit its
                                    // content cap halfway through the maxHeight curve and
                                    // visually stopped growing — making the visible
                                    // expansion feel like it happened in a tiny window.
                                    // Animating height: auto keeps the visible growth
                                    // distributed across the full duration.
                                    initial={{ opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0 }}
                                    animate={{
                                        opacity: 1,
                                        height: 'auto',
                                        paddingTop: 12,
                                        paddingBottom: 12,
                                        transition: {
                                            height:        { duration: 0.45, delay: 0.3, ease: [0.4, 0.0, 0.2, 1] },
                                            paddingTop:    { duration: 0.45, delay: 0.3, ease: [0.4, 0.0, 0.2, 1] },
                                            paddingBottom: { duration: 0.45, delay: 0.3, ease: [0.4, 0.0, 0.2, 1] },
                                            opacity:       { duration: 0.30, delay: 0.45, ease: [0.4, 0.0, 0.2, 1] },
                                        },
                                    }}
                                    exit={{
                                        opacity: 0,
                                        height: 0,
                                        paddingTop: 0,
                                        paddingBottom: 0,
                                        transition: {
                                            height:        { duration: 0.45, ease: [0.4, 0.0, 0.2, 1] },
                                            paddingTop:    { duration: 0.45, ease: [0.4, 0.0, 0.2, 1] },
                                            paddingBottom: { duration: 0.45, ease: [0.4, 0.0, 0.2, 1] },
                                            opacity:       { duration: 0.30, ease: [0.4, 0.0, 0.2, 1] },
                                        },
                                    }}
                                >
                                    {contentFor(tab.id)}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Fragment>
                );
            })}
        </aside>
    );
}
