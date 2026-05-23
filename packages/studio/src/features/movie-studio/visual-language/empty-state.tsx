import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex min-h-36 flex-col items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/15 p-6 text-center',
        className
      )}
    >
      <ImageOff className='mb-3 h-5 w-5 text-muted-foreground' />
      <p className='text-sm font-medium text-foreground'>{title}</p>
      {description ? (
        <p className='mt-1 max-w-md text-xs text-muted-foreground'>{description}</p>
      ) : null}
    </div>
  );
}
