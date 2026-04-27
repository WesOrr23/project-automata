import { LucideIcon, ScrollText, Pencil, Play } from 'lucide-react';

// Tab id stays 'CONFIG' for now — renaming the runtime id is a
// search-and-replace across many call sites and a localStorage
// migration risk. Only the user-facing label + icon change. The
// "Define" framing is what users see; the engine still says CONFIG.
export type ToolTabID = 'CONFIG' | 'EDIT' | 'SIMULATE';

export type ToolMenuState =
    | { mode: 'COLLAPSED' }
    | { mode: 'EXPANDED' }
    | { mode: 'OPEN'; activeTab: ToolTabID };

export type ToolTab  = {
    id: ToolTabID;
    label: string;
    icon: LucideIcon;
};

// Three-stage workflow ladder. The framing is "set up the FA's
// formal definition, build it interactively, then run it":
//   Define   (type, alphabet, ε char, notes) → declarative parts
//   Edit     (states, transitions, accept/start) → constructed parts
//   Simulate (input string, step) → run the thing
// File ops live in the top-center CommandBar widget so the tool
// menu is purely a workflow surface, not a junk drawer for
// orthogonal commands.
export const toolTabs: readonly ToolTab[] = [
    { id: 'CONFIG',     label: 'Define',    icon: ScrollText },
    { id: 'EDIT',       label: 'Edit',      icon: Pencil     },
    { id: 'SIMULATE',   label: 'Simulate',  icon: Play       }
];