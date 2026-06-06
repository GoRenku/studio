import type { ReactNode } from 'react';
import { TabsList, TabsTrigger } from '@/ui/tabs';

interface LineTabBarItem<Value extends string> {
  value: Value;
  label: ReactNode;
}

interface LineTabBarProps<Value extends string> {
  items: Array<LineTabBarItem<Value>>;
  /** Optional content pinned to the far right of the tab bar row. */
  trailing?: ReactNode;
}

export function LineTabBar<Value extends string>({
  items,
  trailing,
}: LineTabBarProps<Value>) {
  return (
    <TabsList
      variant='line'
      className='!h-[45px] w-full justify-start gap-0 rounded-none border-b border-border/40 bg-sidebar-header-bg p-0'
    >
      {items.map((item) => (
        <TabsTrigger
          key={item.value}
          value={item.value}
          className='h-full flex-none rounded-none border-0 px-2 text-[11px] uppercase tracking-[0.12em] font-semibold data-[state=active]:bg-item-active-bg data-[state=active]:text-foreground data-[state=active]:after:bg-primary'
        >
          {item.label}
        </TabsTrigger>
      ))}
      {trailing ? (
        <span className='ml-auto flex items-center pr-3'>{trailing}</span>
      ) : null}
    </TabsList>
  );
}
