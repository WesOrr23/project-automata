import { LucideIcon, Settings, Pencil, Play } from 'lucide-react';

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

// Three-tab workflow ladder: Configure (alphabet, type, ε) →
// Edit (states, transitions) → Simulate (input string, step). File
// ops have moved out into the top-center CommandBar widget so the
// tool menu is purely a workflow surface, not a junk drawer for
// orthogonal commands.
export const toolTabs: readonly ToolTab[] = [
    { id: 'CONFIG',     label: 'Configure', icon: Settings  },
    { id: 'EDIT',       label: 'Edit',      icon: Pencil    },
    { id: 'SIMULATE',   label: 'Simulate',  icon: Play      }
];