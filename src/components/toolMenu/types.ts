import { LucideIcon, Settings, Pencil, Play, FileText } from 'lucide-react';

export type ToolTabID = 'FILE' | 'CONFIG' | 'EDIT' | 'SIMULATE';

export type ToolMenuState =
    | { mode: 'COLLAPSED' }
    | { mode: 'EXPANDED' }
    | { mode: 'OPEN'; activeTab: ToolTabID };

export type ToolTab  = {
    id: ToolTabID;
    label: string;
    icon: LucideIcon;
};

// File tab is leftmost — file ops are workflow-prefix actions
// (open, then edit). Configure is positioned next because alphabet
// + ε-symbol settings are session-level constraints. Edit and
// Simulate flow downward from there.
export const toolTabs: readonly ToolTab[] = [
    { id: 'FILE',       label: 'File',      icon: FileText  },
    { id: 'CONFIG',     label: 'Configure', icon: Settings  },
    { id: 'EDIT',       label: 'Edit',      icon: Pencil    },
    { id: 'SIMULATE',   label: 'Simulate',  icon: Play      }
];