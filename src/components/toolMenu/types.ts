import { LucideIcon, ScrollText, Pencil, Play } from 'lucide-react';

// Tab ids stay 'CONFIG' / 'EDIT' / 'SIMULATE' for now — renaming the
// runtime ids is a search-and-replace across many call sites and a
// localStorage migration risk. Only the user-facing labels + icons
// change. The user sees "Define / Construct / Simulate"; the engine
// still says CONFIG / EDIT / SIMULATE.
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

// Three-stage workflow ladder. The framing is "define the FA's
// formal pieces, construct it interactively, then simulate it":
//   Define    (type, alphabet, ε char, notes) → declarative parts
//   Construct (states, transitions, accept/start) → built parts
//   Simulate  (input string, step) → run the thing
// "Construct" (vs "Edit") avoids verb collision with the inline
// "Edit alphabet" button on Construct's read-only alphabet strip.
// File ops live in the top-center CommandBar widget so the tool
// menu is purely a workflow surface, not a junk drawer for
// orthogonal commands.
export const toolTabs: readonly ToolTab[] = [
    { id: 'CONFIG',     label: 'Define',    icon: ScrollText },
    { id: 'EDIT',       label: 'Construct', icon: Pencil     },
    { id: 'SIMULATE',   label: 'Simulate',  icon: Play       }
];