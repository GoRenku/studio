import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface VisualLanguageReportSectionProps {
  number: string;
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function VisualLanguageReportSection({
  number,
  title,
  children,
  action,
  className,
}: VisualLanguageReportSectionProps) {
  return (
    <section
      className={cn(
        'grid grid-cols-1 gap-3 border-b border-border/40 py-7 lg:grid-cols-[minmax(160px,0.38fr)_minmax(0,1fr)] lg:gap-7',
        className
      )}
    >
      <div className='space-y-2'>
        <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          {number}
        </p>
        <div className='flex items-center justify-between gap-2 lg:block'>
          <h3 className='text-sm font-semibold text-foreground'>{title}</h3>
          {action ? <div className='lg:mt-3'>{action}</div> : null}
        </div>
      </div>
      <div className='min-w-0 space-y-4 text-sm text-foreground'>{children}</div>
    </section>
  );
}
