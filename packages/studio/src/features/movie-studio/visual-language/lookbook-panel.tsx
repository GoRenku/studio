import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type {
  InspirationFolderWithResolvedPath,
  LookbookType,
  LookbookResource,
} from '@gorenku/studio-core/client';
import {
  deleteLookbookImage,
  deleteLookbookSheet,
  readLookbook,
  setDefaultLookbookSheet,
  selectLookbookForType,
} from '@/services/studio-visual-language-api';
import {
  matchesVisualLanguageLookbookResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
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

  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) =>
      matchesVisualLanguageLookbookResource(resourceKeys, lookbookId),
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  const selectForType = async (type: LookbookType) => {
    await selectLookbookForType(projectName, type, lookbookId);
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
    <LineTabs
      defaultValue='definition'
      items={[
        { value: 'definition', label: 'Definition' },
        { value: 'visual', label: 'Visual Content' },
      ]}
    >
      <LineTabsContent value='definition'>
        <VisualLanguageReport
          projectName={projectName}
          title={resource.lookbook.name}
          headerMeta={
            <LookbookHeaderMeta
              type={resource.lookbook.type}
              sourceInspirationFolders={resource.sourceInspirationFolders}
            />
          }
          action={
            !resource.isSelectedForType ? (
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => void selectForType(resource.lookbook.type)}
              >
                {resource.lookbook.type === 'movie'
                  ? 'Use for movie generation'
                  : 'Use for storyboard images'}
              </Button>
            ) : null
          }
          source={{
            kind: 'lookbook',
            imagesBySection: resource.imagesBySection,
            imagesByPoint: resource.imagesByPoint,
          }}
          sections={resource.lookbook.definition}
        />
      </LineTabsContent>
      <LineTabsContent value='visual'>
        <LookbookVisualContentTab
          projectName={projectName}
          resource={resource}
          onDeleteImage={removeImage}
          onDeleteSheet={removeSheet}
          onSetDefaultSheet={setDefaultSheet}
        />
      </LineTabsContent>
    </LineTabs>
  );
}

function LookbookHeaderMeta({
  type,
  sourceInspirationFolders,
}: {
  type: LookbookType;
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
}) {
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge variant='accent'>{type === 'movie' ? 'Movie' : 'Storyboard'}</Badge>
      <SourceInspirationList
        sourceInspirationFolders={sourceInspirationFolders}
      />
    </div>
  );
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
    <>
      <span className='text-[11px] font-semibold uppercase text-muted-foreground'>
        Source Inspiration
      </span>
      {sourceInspirationFolders.map((folder) => (
        <Badge key={folder.id}>
          {folder.name}
        </Badge>
      ))}
    </>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Lookbook request failed.';
}
