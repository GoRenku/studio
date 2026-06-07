import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  if (status.state === 'idle' || !status.message) {
    return null;
  }

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
        <XCircle className='h-3 w-3 shrink-0' />
      )}
      <span className='truncate'>{status.message}</span>
    </div>
  );
}
