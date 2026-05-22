import type { ReactNode } from 'react';

interface PanelShellProps {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function PanelShell({ title, action, children }: PanelShellProps) {
  return (
    <section className='min-h-0 rounded-(--radius-panel) border border-panel-border bg-panel-bg overflow-hidden flex flex-col'>
      <div className='h-[45px] px-4 border-b border-border/40 bg-panel-header-bg flex items-center justify-between shrink-0'>
        <h2 className='truncate text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
          {title}
        </h2>
        {action}
      </div>
      <div className='flex-1 min-h-0 overflow-y-auto p-4'>{children}</div>
    </section>
  );
}
