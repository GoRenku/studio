import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type {
  InspirationFolderWithResolvedPath,
  LookbookResource,
} from '@gorenku/studio-core/client';
import {
  deleteLookbookImage,
  deleteLookbookSheet,
  readLookbook,
  setDefaultLookbookSheet,
  setActiveLookbook,
} from '@/services/studio-visual-language-api';
import { Button } from '@/ui/button';
import { LineTabBar } from '@/ui/line-tab-bar';
import { Tabs, TabsContent } from '@/ui/tabs';
import { EmptyState } from './empty-state';
import { LookbookVisualContentTab } from './lookbook-visual-content-tab';
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

  const refreshLookbook = useCallback(async () => {
    setResource(await readLookbook(projectName, lookbookId));
  }, [lookbookId, projectName]);

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
    await refreshLookbook();
    onLookbooksChange();
  };

  const removeImage = async (imageId: string) => {
    try {
      await deleteLookbookImage(projectName, imageId);
      await refreshLookbook();
      onLookbooksChange();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const removeSheet = async (sheetId: string) => {
    try {
      await deleteLookbookSheet(projectName, sheetId);
      await refreshLookbook();
      onLookbooksChange();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const setDefaultSheet = async (sheetId: string) => {
    try {
      await setDefaultLookbookSheet(projectName, sheetId);
      await refreshLookbook();
      onLookbooksChange();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (!resource) {
    return <EmptyState title='Loading Lookbook.' />;
  }

  return (
    <Tabs defaultValue='definition' className='h-full gap-0'>
      <LineTabBar
        items={[
          { value: 'definition', label: 'Definition' },
          { value: 'visual', label: 'Visual Content' },
        ]}
      />
      <TabsContent value='definition' className='min-h-0 overflow-y-auto p-0'>
        <VisualLanguageReport
          projectName={projectName}
          title={resource.lookbook.name}
          headerMeta={
            <SourceInspirationList
              sourceInspirationFolders={resource.sourceInspirationFolders}
            />
          }
          action={
            !resource.isActive ? (
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => void makeActive()}
              >
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
      </TabsContent>
      <TabsContent value='visual' className='min-h-0 overflow-y-auto p-0'>
        <LookbookVisualContentTab
          projectName={projectName}
          resource={resource}
          onDeleteImage={removeImage}
          onDeleteSheet={removeSheet}
          onSetDefaultSheet={setDefaultSheet}
        />
      </TabsContent>
    </Tabs>
  );
}

interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}

function SourceInspirationList({
  sourceInspirationFolders,
}: {
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
}) {
  if (sourceInspirationFolders.length === 0) {
    return null;
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
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
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Lookbook request failed.';
}
