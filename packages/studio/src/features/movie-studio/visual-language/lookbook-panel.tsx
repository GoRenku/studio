import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { LookbookResource } from '@gorenku/studio-core/client';
import { readLookbook, setActiveLookbook } from '@/services/studio-visual-language-api';
import { Button } from '@/ui/button';
import { EmptyState } from './empty-state';
import { VisualLanguageReport } from './visual-language-report';

interface LookbookPanelProps {
  projectName: string;
  lookbookId: string;
  onLookbooksChange: () => void;
}

export function LookbookPanel({
  projectName,
  lookbookId,
  onLookbooksChange,
}: LookbookPanelProps) {
  const [resource, setResource] = useState<LookbookResource | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readLookbook(projectName, lookbookId)
      .then((nextResource) => {
        if (!cancelled) setResource(nextResource);
      })
      .catch((error) => toast.error(errorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [projectName, lookbookId]);

  const makeActive = async () => {
    await setActiveLookbook(projectName, lookbookId);
    setResource(await readLookbook(projectName, lookbookId));
    onLookbooksChange();
  };

  if (!resource) {
    return <EmptyState title='Loading Lookbook.' />;
  }

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
            Lookbook
          </p>
          <h2 className='mt-1 text-lg font-semibold'>{resource.lookbook.name}</h2>
          <p className='mt-1 text-xs text-muted-foreground'>
            {resource.isActive ? 'Active lookbook' : 'Not active'}
          </p>
        </div>
        {!resource.isActive ? (
          <Button type='button' variant='outline' size='sm' onClick={() => void makeActive()}>
            Set active
          </Button>
        ) : null}
      </div>
      <VisualLanguageReport
        projectName={projectName}
        source={{ kind: 'lookbook', imagesBySection: resource.imagesBySection }}
        sections={{
          thesis: resource.lookbook.thesis,
          palette: resource.lookbook.palette,
          toneMood: resource.lookbook.toneMood,
          composition: resource.lookbook.composition,
          lighting: resource.lookbook.lighting,
          texture: resource.lookbook.texture,
          camera: resource.lookbook.camera,
        }}
      />
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Lookbook request failed.';
}
