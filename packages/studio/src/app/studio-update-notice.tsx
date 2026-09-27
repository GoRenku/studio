import { useState } from 'react';
import { CircleArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';
import type { StudioUpdateController } from './use-studio-update';

export function StudioUpdateNotice({ update }: { update: StudioUpdateController }) {
  const [open, setOpen] = useState(false);
  if (update.status?.state !== 'available') return null;
  const terminal = navigator.platform.startsWith('Win') ? 'PowerShell' : 'Terminal';

  const handleOpenChange = (nextOpen: boolean) => {
    if (update.handoff !== 'idle') return;
    setOpen(nextOpen);
    if (!nextOpen) update.clearError();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='relative h-7 w-7 text-foreground'
              aria-label={`Update available: version ${update.status.publishedVersion}. Open update details.`}
            >
              <CircleArrowUp className='h-4 w-4' />
              <span aria-hidden='true' className='absolute right-1 top-1 h-[5px] w-[5px] rounded-full bg-amber-500' />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>Update available</TooltipContent>
      </Tooltip>
      <DialogContent
        className='max-w-[460px] gap-0 overflow-hidden p-0'
        showCloseButton={update.handoff === 'idle'}
      >
        <DialogHeader>
          <DialogTitle>Update Renku Studio</DialogTitle>
          <DialogDescription className='sr-only'>
            Review the available Renku Studio update.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-3 px-6 py-6'>
          {update.handoff === 'started' ? (
            <p className='text-sm font-medium'>Update is continuing in {terminal}.</p>
          ) : (
            <>
              <p className='text-base font-semibold'>
                Version {update.status.publishedVersion} is available
              </p>
              <p className='text-sm text-muted-foreground'>
                Installed version: {update.status.installedVersion}
              </p>
              <p className='text-sm text-muted-foreground'>
                Studio will close while the update runs in {terminal}, then reopen.
                Finish your edits before continuing.
              </p>
              {update.error ? (
                <p role='alert' className='text-sm text-destructive'>
                  {update.error}
                </p>
              ) : null}
            </>
          )}
        </div>
        {update.handoff !== 'started' ? (
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              disabled={update.handoff === 'starting'}
              onClick={() => {
                setOpen(false);
                update.clearError();
              }}
            >
              Not now
            </Button>
            <Button
              type='button'
              disabled={update.handoff === 'starting'}
              onClick={() => void update.confirm()}
            >
              {update.handoff === 'starting' ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
              Download and update
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
