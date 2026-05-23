import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';

interface StudioSidebarHoverActionRowProps {
  active: boolean;
  icon: ReactNode;
  label: string;
  action: ReactNode;
  onSelect: () => void;
}

export function StudioSidebarHoverActionRow({
  active,
  icon,
  label,
  action,
  onSelect,
}: StudioSidebarHoverActionRowProps) {
  return (
    <div
      className={cn(
        'group flex min-w-0 items-center gap-1 rounded-md border transition-colors',
        active
          ? 'border-item-active-border bg-item-active-bg'
          : 'border-transparent hover:border-border/50 hover:bg-item-hover-bg'
      )}
    >
      <Button
        type='button'
        variant='ghost'
        className='h-8 min-w-0 flex-1 justify-start gap-2 px-2 text-left hover:bg-transparent'
        onClick={onSelect}
      >
        <span className='shrink-0 text-muted-foreground'>{icon}</span>
        <span className='min-w-0 flex-1 truncate text-sm font-medium'>{label}</span>
      </Button>
      <span className='flex h-8 w-8 shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100'>
        {action}
      </span>
    </div>
  );
}
