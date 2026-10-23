import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AgentRequest, AgentRequestLine } from '@/ui/agent-request';

interface PanelEmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  /** Shown above the title in place of the icon, e.g. a StepChain of missing work. */
  prerequisite?: ReactNode;
  request?: string;
  moreRequests?: string[];
  /** A faint, decorative outline of the filled page drawn behind the content. */
  preview?: ReactNode;
  className?: string;
}

/** The page-level empty state: what will appear here and the request that makes it. */
export function PanelEmptyState({
  title,
  description,
  icon: Icon,
  prerequisite,
  request,
  moreRequests = [],
  preview,
  className,
}: PanelEmptyStateProps) {
  return (
    <div className={cn('relative flex min-h-[420px] flex-1 overflow-hidden', className)}>
      {preview ? (
        <>
          <div aria-hidden='true' className='pointer-events-none absolute inset-0 opacity-50'>
            {preview}
          </div>
          <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--panel-bg)_0%,color-mix(in_srgb,var(--panel-bg)_70%,transparent)_45%,transparent_80%)]'
          />
        </>
      ) : null}
      <div className='relative flex flex-1 items-center justify-center px-6 py-12'>
        <div className='flex w-full max-w-[540px] flex-col items-center text-center'>
          {prerequisite ? (
            <div className='mb-8 w-full'>{prerequisite}</div>
          ) : Icon ? (
            <span className='mb-[18px] flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground'>
              <Icon className='h-[18px] w-[18px]' />
            </span>
          ) : null}
          <h2 className='text-lg font-bold text-foreground text-balance'>{title}</h2>
          <p className='mt-2 text-[13px] leading-relaxed text-muted-foreground'>{description}</p>
          {request ? <AgentRequest request={request} className='mt-7' /> : null}
          {moreRequests.length > 0 ? (
            <div className='mt-2.5 flex w-full flex-col gap-0.5'>
              {moreRequests.map((moreRequest) => (
                <AgentRequestLine key={moreRequest} request={moreRequest} />
              ))}
            </div>
          ) : null}
          {request ? (
            <p className='mt-6 text-[11px] text-muted-foreground'>
              Paste into Claude or Codex. Studio updates while your agent works.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
