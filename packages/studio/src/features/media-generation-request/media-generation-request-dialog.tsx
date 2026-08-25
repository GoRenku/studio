import type { MediaGenerationPreviewResource } from '@gorenku/studio-core/client';
import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import {
  MediaGenerationRequestView,
  type MediaGenerationRequestTab,
} from './media-generation-request-view';

interface MediaGenerationRequestUpdateAction {
  disabled: boolean;
  pending: boolean;
  onUpdate: () => void;
}

export function MediaGenerationRequestDialog({
  open,
  onOpenChange,
  preview,
  prompt,
  tab,
  onPromptChange,
  onTabChange,
  loading = false,
  unavailableMessage,
  footerError,
  tabTrailing,
  updateAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: MediaGenerationPreviewResource | null;
  prompt: string | null;
  tab: MediaGenerationRequestTab;
  onPromptChange: (prompt: string) => void;
  onTabChange: (tab: MediaGenerationRequestTab) => void;
  loading?: boolean;
  unavailableMessage?: string | null;
  footerError?: string | null;
  tabTrailing?: ReactNode;
  updateAction?: MediaGenerationRequestUpdateAction;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='generation-request-dialog h-[760px] w-[1120px] max-h-[calc(100vh-6rem)] max-w-[calc(100vw-6rem)] grid-rows-[54px_46px_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0'>
        <DialogHeader className='h-[54px] justify-center py-0 pr-12'>
          <DialogTitle>Media Generation Request</DialogTitle>
          <DialogDescription className='sr-only'>
            Review the saved prompt, references, and configuration.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className='row-span-2 flex min-h-0 items-center justify-center text-sm text-muted-foreground'>
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            Loading generation request...
          </div>
        ) : unavailableMessage || !preview ? (
          <div className='row-span-2 min-h-0 overflow-auto px-6 py-5'>
            <Alert variant='destructive'>
              <AlertCircle />
              <AlertTitle>Generation Request Unavailable</AlertTitle>
              <AlertDescription>
                {unavailableMessage ?? 'The saved request could not be loaded.'}
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <MediaGenerationRequestView
            preview={preview}
            prompt={prompt}
            tab={tab}
            onPromptChange={onPromptChange}
            onTabChange={onTabChange}
            tabTrailing={tabTrailing}
          />
        )}
        <DialogFooter>
          {footerError ? <p className='mr-auto text-sm text-destructive'>{footerError}</p> : null}
          {updateAction ? (
            <Button
              type='button'
              onClick={updateAction.onUpdate}
              disabled={updateAction.disabled || updateAction.pending}
            >
              {updateAction.pending ? 'Updating...' : 'Update'}
            </Button>
          ) : null}
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
