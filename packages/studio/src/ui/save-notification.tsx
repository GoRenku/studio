import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';

export type SaveNotificationState = 'idle' | 'saving' | 'saved' | 'error';

export interface SaveNotificationStatus {
  state: SaveNotificationState;
  message: string | null;
}

interface SaveNotificationProps {
  status: SaveNotificationStatus;
  className?: string;
}

export function SaveNotification({
  status,
  className,
}: SaveNotificationProps) {
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const notificationKey = useMemo(
    () => `${status.state}:${status.message ?? ''}`,
    [status.message, status.state]
  );

  if (status.state === 'idle' || !status.message) {
    return null;
  }
  if (dismissedKey === notificationKey) {
    return null;
  }

  const canDismiss = status.state === 'error';

  return (
    <div
      className={cn(
        'inline-flex max-w-[22rem] items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        status.state === 'error'
          ? 'border-red-500/45 bg-red-500/14 text-red-700 dark:text-red-300'
          : 'border-emerald-500/45 bg-emerald-500/14 text-emerald-700 dark:text-emerald-300',
        className
      )}
      role={status.state === 'error' ? 'alert' : 'status'}
      aria-live={status.state === 'error' ? 'assertive' : 'polite'}
    >
      {status.state === 'saving' ? (
        <Loader2 className='h-3 w-3 shrink-0 animate-spin' />
      ) : status.state === 'saved' ? (
        <CheckCircle2 className='h-3 w-3 shrink-0' />
      ) : (
        <CircleAlert className='h-3 w-3 shrink-0' />
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className='truncate'
            tabIndex={0}
            title={status.message}
          >
            {status.message}
          </span>
        </TooltipTrigger>
        <TooltipContent
          align='end'
          className='max-w-md whitespace-normal text-left'
          side='bottom'
        >
          {status.message}
        </TooltipContent>
      </Tooltip>
      {canDismiss ? (
        <Button
          aria-label='Dismiss save notification'
          className={cn(
            '-mr-1 h-5 w-5 shrink-0 rounded-full p-0',
            'text-current hover:bg-current/10 hover:text-current'
          )}
          onClick={() => setDismissedKey(notificationKey)}
          size='icon'
          type='button'
          variant='ghost'
        >
          <X className='h-3 w-3' aria-hidden />
          <span className='sr-only'>Dismiss save notification</span>
        </Button>
      ) : null}
    </div>
  );
}
