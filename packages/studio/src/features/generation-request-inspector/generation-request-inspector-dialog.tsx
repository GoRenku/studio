import { useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { createGenerationPreviewDraft } from '@/features/generation-preview/generation-preview-draft';
import {
  GenerationRequestEditor,
  type GenerationRequestEditorTab,
} from '@/features/generation-request-editor/generation-request-editor';
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
import type { GenerationRequestInspectorInput } from './use-generation-request-inspector';
import { useGenerationRequestInspector } from './use-generation-request-inspector';

export function GenerationRequestInspectorDialog({
  input,
  open,
  onOpenChange,
}: {
  input: GenerationRequestInspectorInput;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<GenerationRequestEditorTab>('prompt');
  const { preview, error, loading } = useGenerationRequestInspector(input);
  const draft = preview ? createGenerationPreviewDraft(preview) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='generation-request-dialog h-[760px] w-[1120px] max-h-[calc(100vh-6rem)] max-w-[calc(100vw-6rem)] grid-rows-[54px_46px_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0'>
        <DialogHeader className='h-[54px] justify-center py-0 pr-12'>
          <DialogTitle>Generation Request</DialogTitle>
          <DialogDescription className='sr-only'>
            Inspect the exact saved prompt, references, and configuration.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className='flex min-h-0 items-center justify-center text-sm text-muted-foreground'>
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            Loading generation request...
          </div>
        ) : error || !preview || !draft ? (
          <div className='min-h-0 overflow-auto px-6 py-5'>
            <Alert variant='destructive'>
              <AlertCircle />
              <AlertTitle>Generation Request Unavailable</AlertTitle>
              <AlertDescription>{error ?? 'The saved request could not be loaded.'}</AlertDescription>
            </Alert>
          </div>
        ) : (
          <GenerationRequestEditor
            preview={preview}
            draft={draft}
            editorRevision={0}
            tab={tab}
            error={null}
            errorTitle='Generation Request Unavailable'
            pending={false}
            readOnly
            onTabChange={setTab}
            onAuthoredTextChange={() => {}}
            onNegativeTextChange={() => {}}
          />
        )}
        <DialogFooter>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
