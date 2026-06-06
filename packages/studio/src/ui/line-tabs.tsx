import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LineTabBar } from '@/ui/line-tab-bar';
import { Tabs, TabsContent } from '@/ui/tabs';

export interface LineTabsItem<Value extends string> {
  value: Value;
  label: ReactNode;
}

interface LineTabsProps<Value extends string>
  extends ComponentProps<typeof Tabs> {
  items: Array<LineTabsItem<Value>>;
  trailing?: ReactNode;
}

export function LineTabs<Value extends string>({
  items,
  trailing,
  className,
  children,
  ...props
}: LineTabsProps<Value>) {
  return (
    <Tabs className={cn('h-full gap-0', className)} {...props}>
      <LineTabBar items={items} trailing={trailing} />
      {children}
    </Tabs>
  );
}

export function LineTabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsContent>) {
  return (
    <TabsContent
      className={cn('min-h-0 overflow-y-auto p-0', className)}
      {...props}
    />
  );
}
