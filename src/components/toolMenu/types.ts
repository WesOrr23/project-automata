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

export const toolTabs: readonly ToolTab[] = [
    { id: 'CONFIG',     label: 'Configure', icon: Settings  },
    { id: 'EDIT',       label: 'Edit',      icon: Pencil    },
    { id: 'SIMULATE',   label: 'Simulate',  icon: Play      }
];