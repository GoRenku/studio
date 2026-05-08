import { LineTabBar } from '@/ui/line-tab-bar';
import { Tabs } from '@/ui/tabs';
import type { CastDesignTabId } from '../cast-design-types';

const castDesignTabs: Array<{ id: CastDesignTabId; label: string }> = [
  { id: 'description', label: 'Description' },
  { id: 'character-sheet', label: 'Character Sheet' },
  { id: 'voice-design', label: 'Voice Design' },
];

interface CastDesignTabBarProps {
  activeTab: CastDesignTabId;
  onTabChange: (tab: CastDesignTabId) => void;
}

export function CastDesignTabBar({
  activeTab,
  onTabChange,
}: CastDesignTabBarProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => onTabChange(value as CastDesignTabId)}
      className='shrink-0 gap-0'
    >
      <LineTabBar
        items={castDesignTabs.map((tab) => ({
          value: tab.id,
          label: tab.label,
        }))}
      />
    </Tabs>
  );
}
