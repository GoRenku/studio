import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  SaveNotification,
  type SaveNotificationStatus,
} from '@/ui/save-notification';

interface PanelShellProps {
  title: ReactNode;
  action?: ReactNode;
  saveNotification?: SaveNotificationStatus;
  contentClassName?: string;
  children: ReactNode;
}

export function PanelShell({
  title,
  action,
  saveNotification,
  contentClassName,
  children,
}: PanelShellProps) {
  const hasSaveNotification =
    saveNotification &&
    saveNotification.state !== 'idle' &&
    Boolean(saveNotification.message);

  return (
    <section className='h-full min-h-0 rounded-(--radius-panel) border border-panel-border bg-panel-bg overflow-hidden flex flex-col'>
      <div className='h-[45px] px-4 border-b border-border/40 bg-panel-header-bg flex items-center justify-between shrink-0'>
        <h2 className='truncate text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
          {title}
        </h2>
        {action || hasSaveNotification ? (
          <div className='ml-3 flex min-w-0 shrink-0 items-center gap-2'>
            {action}
            {saveNotification ? (
              <SaveNotification
                status={saveNotification}
                className='shrink-0'
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={cn('flex-1 min-h-0 overflow-y-auto p-4', contentClassName)}>
        {children}
      </div>
    </section>
  );
}
