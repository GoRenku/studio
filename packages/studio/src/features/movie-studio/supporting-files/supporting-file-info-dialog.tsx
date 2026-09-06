import { useEffect, useState } from 'react';
import { FileText, FolderOpen } from 'lucide-react';
import type { ProjectSupportingFile } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/ui/dialog';
import { openSupportingFileFolder, readSupportingFileInformation, type SupportingFileInformationResponse } from '@/services/supporting-files';

export function SupportingFileInfoDialog({ projectName, file, onClose }: {
  projectName: string;
  file: ProjectSupportingFile;
  onClose: () => void;
}) {
  const [information, setInformation] = useState<SupportingFileInformationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  useEffect(() => {
    let current = true;
    void readSupportingFileInformation(projectName, file.asset.id).then(
      (result) => { if (current) setInformation(result); },
      (failure: Error) => { if (current) setError(failure.message); },
    );
    return () => { current = false; };
  }, [projectName, file.asset.id]);

  const openFolder = async () => {
    setOpening(true);
    setError(null);
    try {
      await openSupportingFileFolder(projectName, file.asset.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not open the containing folder.');
    } finally {
      setOpening(false);
    }
  };
  const asset = information?.supportingFile.asset ?? file.asset;
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className='gap-0 overflow-hidden p-8 font-sans font-normal sm:max-w-[560px]'>
        <div className='flex items-center gap-4 pr-5'>
          <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/5 text-primary'>
            <FileText className='h-6 w-6' strokeWidth={1.5} />
          </div>
          <div className='min-w-0 space-y-2'>
            <DialogTitle>File information</DialogTitle>
            <DialogDescription className='break-words text-sm font-normal leading-5'>{asset.title}</DialogDescription>
          </div>
        </div>
        <div className='mt-7 flex items-end justify-between gap-6'>
          <dl className='min-w-0 space-y-5 text-[13px] font-normal leading-5'>
            <div className='grid grid-cols-[88px_1fr] items-baseline gap-3'>
              <dt className='text-muted-foreground'>Imported</dt>
              <dd className='font-normal tabular-nums text-foreground/85'>{formatFileDate(asset.createdAt)}</dd>
            </div>
            <div className='grid grid-cols-[88px_1fr] items-baseline gap-3'>
              <dt className='text-muted-foreground'>Last updated</dt>
              <dd className='font-normal tabular-nums text-foreground/85'>{formatFileDate(asset.updatedAt)}</dd>
            </div>
          </dl>
          <Button variant='outline' className='shrink-0 gap-2 border-primary/40 text-[13px] font-medium text-primary hover:bg-primary/10 hover:text-primary' disabled={!information || opening} onClick={() => void openFolder()}>
            <FolderOpen className='h-4 w-4' />
            {opening ? 'Opening…' : 'Open In Folder'}
          </Button>
        </div>
        {error ? <p role='alert' className='mt-4 text-sm text-destructive'>{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

function formatFileDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}
