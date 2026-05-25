import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import type {
  InspirationFolderWithResolvedPath,
  LookbookResource,
} from '@gorenku/studio-core/client';
import {
  deleteLookbookImage,
  readLookbook,
  setActiveLookbook,
} from '@/services/studio-visual-language-api';
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
  const [resourceRevision, setResourceRevision] = useState(0);

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
  }, [projectName, lookbookId, resourceRevision]);

  useEffect(() => {
    const handleResourceChanged = (event: Event) => {
      const detail = (event as CustomEvent<StudioResourceChangedDetail>).detail;
      if (!detail || detail.projectName !== projectName) {
        return;
      }
      const hasLookbookChange = detail.resourceKeys.some(
        (resourceKey) =>
          resourceKey === 'surface:visual-language:lookbooks' ||
          resourceKey === `surface:visual-language:lookbook:${lookbookId}`
      );
      if (hasLookbookChange) {
        setResourceRevision((current) => current + 1);
      }
    };

    window.addEventListener('renku:studio-resource-changed', handleResourceChanged);
    return () => {
      window.removeEventListener('renku:studio-resource-changed', handleResourceChanged);
    };
  }, [lookbookId, projectName]);

  const makeActive = async () => {
    await setActiveLookbook(projectName, lookbookId);
    setResource(await readLookbook(projectName, lookbookId));
    onLookbooksChange();
  };

  const removeImage = async (imageId: string) => {
    try {
      await deleteLookbookImage(projectName, imageId);
      setResource(await readLookbook(projectName, lookbookId));
      onLookbooksChange();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (!resource) {
    return <EmptyState title='Loading Lookbook.' />;
  }

  return (
    <div className='min-h-full'>
      <SourceInspirationStrip
        sourceInspirationFolders={resource.sourceInspirationFolders}
      />
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
        onDeleteLookbookImage={removeImage}
      />
    </div>
  );
}

interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}

function SourceInspirationStrip({
  sourceInspirationFolders,
}: {
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
}) {
  if (sourceInspirationFolders.length === 0) {
    return null;
  }

  return (
    <div className='border-b border-border/40 bg-panel-bg px-5 py-3 sm:px-8 lg:px-12'>
      <div className='mx-auto flex max-w-[1240px] flex-wrap items-center gap-2'>
        <span className='text-[11px] font-semibold uppercase text-muted-foreground'>
          Source Inspiration
        </span>
        {sourceInspirationFolders.map((folder) => (
          <span
            key={folder.id}
            className='rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground/75'
          >
            {folder.name}
          </span>
        ))}
      </div>
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Lookbook request failed.';
}
