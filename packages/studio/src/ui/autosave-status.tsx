import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DebouncedAutosaveStatus } from '@/hooks/use-debounced-autosave';

interface AutosaveStatusProps {
  status: DebouncedAutosaveStatus;
  className?: string;
}

export function AutosaveStatus({ status, className }: AutosaveStatusProps) {
  if (status.state === 'idle' || !status.message) {
    return null;
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium',
        status.state === 'error'
          ? 'border-red-500/45 bg-red-500/14 text-red-700 dark:text-red-300'
          : 'border-emerald-500/45 bg-emerald-500/14 text-emerald-700 dark:text-emerald-300',
        className
      )}
      role={status.state === 'error' ? 'alert' : 'status'}
    >
      {status.state === 'saving' ? (
        <Loader2 className='h-3 w-3 animate-spin' />
      ) : status.state === 'saved' ? (
        <CheckCircle2 className='h-3 w-3' />
      ) : (
        <XCircle className='h-3 w-3' />
      )}
      <span>{status.message}</span>
    </div>
  );
}
