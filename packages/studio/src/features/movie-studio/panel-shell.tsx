import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PanelShellProps {
  title: ReactNode;
  action?: ReactNode;
  contentClassName?: string;
  children: ReactNode;
}

export function PanelShell({
  title,
  action,
  contentClassName,
  children,
}: PanelShellProps) {
  return (
    <section className='h-full min-h-0 rounded-(--radius-panel) border border-panel-border bg-panel-bg overflow-hidden flex flex-col'>
      <div className='h-[45px] px-4 border-b border-border/40 bg-panel-header-bg flex items-center justify-between shrink-0'>
        <h2 className='truncate text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
          {title}
        </h2>
        {action}
      </div>
      <div className={cn('flex-1 min-h-0 overflow-y-auto p-4', contentClassName)}>
        {children}
      </div>
    </section>
  );
}
