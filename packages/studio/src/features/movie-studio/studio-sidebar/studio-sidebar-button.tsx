import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';

interface StudioSidebarButtonProps {
  active: boolean;
  icon: ReactNode;
  label: string;
  detail: string;
  disclosure?: {
    expanded: boolean;
    label: string;
    onToggle: () => void;
  };
  compact?: boolean;
  onClick: () => void;
}

export function StudioSidebarButton({
  active,
  icon,
  label,
  detail,
  disclosure,
  compact = false,
  onClick,
}: StudioSidebarButtonProps) {
  return (
    <div
      className={cn(
        'w-full min-w-0 rounded-md border text-left transition-colors flex items-start gap-2',
        compact ? 'px-2 py-1.5' : 'px-3 py-2.5',
        active
          ? 'border-item-active-border bg-item-active-bg'
          : 'border-transparent hover:bg-item-hover-bg hover:border-border/50'
      )}
    >
      <Button
        type='button'
        variant='ghost'
        onClick={onClick}
        className='h-auto min-w-0 flex-1 items-start justify-start gap-2 whitespace-normal p-0 text-left hover:bg-transparent'
      >
        <span className='mt-0.5 shrink-0 text-muted-foreground'>{icon}</span>
        <span className='min-w-0 flex-1'>
          <span className='block truncate text-sm font-medium'>{label}</span>
          <span className='block truncate text-xs text-muted-foreground'>
            {detail}
          </span>
        </span>
      </Button>
      {disclosure ? (
        <Button
          type='button'
          variant='ghost'
          size='icon'
          aria-label={disclosure.label}
          aria-expanded={disclosure.expanded}
          onClick={disclosure.onToggle}
          className='mt-0.5 -mr-1 h-6 w-6 shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
        >
          {disclosure.expanded ? (
            <ChevronDown className='h-3.5 w-3.5' />
          ) : (
            <ChevronRight className='h-3.5 w-3.5' />
          )}
        </Button>
      ) : (
        <span className='mt-2 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/30' />
      )}
    </div>
  );
}
