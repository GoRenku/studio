import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/ui/button';
import { ThemeToggle } from '@/ui/theme-toggle';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';

interface StudioSidebarActionsProps {
  isProductionExportRunning: boolean;
  onProductionExport: () => void;
}

export function StudioSidebarActions({
  isProductionExportRunning,
  onProductionExport,
}: StudioSidebarActionsProps) {
  return (
    <div className='flex shrink-0 items-center gap-2'>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            onClick={() => void onProductionExport()}
            disabled={isProductionExportRunning}
            className='h-8 w-8 rounded-md border border-sidebar-border/70 bg-background/25 text-muted-foreground shadow-sm hover:bg-item-hover-bg hover:text-foreground'
            aria-label='Export production assets'
          >
            {isProductionExportRunning ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Upload className='h-4 w-4' />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side='bottom'>Export production assets</TooltipContent>
      </Tooltip>
      <ThemeToggle />
    </div>
  );
}
