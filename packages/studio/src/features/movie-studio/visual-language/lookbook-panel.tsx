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
    <div className='min-h-full'>
      <VisualLanguageReport
        projectName={projectName}
        title={resource.lookbook.name}
        subtitle={resource.isActive ? 'Active lookbook' : 'Draft lookbook'}
        action={
          !resource.isActive ? (
            <Button type='button' variant='outline' size='sm' onClick={() => void makeActive()}>
              Set active
            </Button>
          ) : null
        }
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
