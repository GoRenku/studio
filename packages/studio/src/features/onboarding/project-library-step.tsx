import { useState } from 'react';
import { AlertCircle, FolderOpen, Loader2 } from 'lucide-react';
import { StudioApiError } from '@/services/studio-api-errors';
import { initializeRenkuSetup } from '@/services/studio-setup-api';
import { Alert, AlertDescription } from '@/ui/alert';
import { Button } from '@/ui/button';

export interface ProjectLibraryStepProps {
  recommendedStorageRoot: string;
  onInitialized: (storageRoot: string) => void;
}

export function ProjectLibraryStep({
  recommendedStorageRoot,
  onInitialized,
}: ProjectLibraryStepProps) {
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<{
    message: string;
    suggestion?: string;
  } | null>(null);

  const initialize = async () => {
    setInitializing(true);
    setError(null);
    try {
      const report = await initializeRenkuSetup();
      onInitialized(report.setup.storageRoot);
    } catch (caught) {
      setError({
        message:
          caught instanceof Error
            ? caught.message
            : 'The Project Library could not be created.',
        suggestion:
          caught instanceof StudioApiError ? caught.suggestion : undefined,
      });
    } finally {
      setInitializing(false);
    }
  };

  return (
    <section className='overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-xl shadow-black/5'>
      <div className='space-y-7 px-10 py-10'>
        <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary'>
          <FolderOpen className='h-6 w-6' />
        </div>
        <div className='max-w-2xl space-y-3'>
          <h1 className='text-3xl font-semibold tracking-tight'>Welcome to Renku</h1>
          <p className='text-base leading-7 text-muted-foreground'>
            Your Projects and their media will live together in one Project
            Library on this computer.
          </p>
        </div>

        <div className='rounded-xl border border-border/50 bg-background/55 px-5 py-4'>
          <p className='text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground'>
            Project Library
          </p>
          <code className='mt-2 block break-all text-[15px] font-medium text-foreground'>
            {recommendedStorageRoot}
          </code>
        </div>

        {error ? (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertDescription>
              <p>{error.message}</p>
              {error.suggestion ? <p>{error.suggestion}</p> : null}
            </AlertDescription>
          </Alert>
        ) : null}

        <p className='text-sm leading-6 text-muted-foreground'>
          To use another location, close Studio, run{' '}
          <code className='rounded bg-muted px-1.5 py-0.5 text-foreground'>
            renku init &lt;storage-root&gt;
          </code>
          , then start Studio again.
        </p>
      </div>

      <div className='flex justify-end border-t border-border/50 bg-muted/20 px-10 py-5'>
        <Button
          type='button'
          size='lg'
          className='min-w-52 gap-2'
          disabled={initializing}
          onClick={() => void initialize()}
        >
          {initializing ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
          {initializing ? 'Creating Project Library…' : 'Use this Project Library'}
        </Button>
      </div>
    </section>
  );
}
