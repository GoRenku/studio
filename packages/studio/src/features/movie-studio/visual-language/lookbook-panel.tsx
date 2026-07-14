import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type {
  InspirationFolderWithResolvedPath,
  LookbookKind,
  LookbookResource,
} from '@gorenku/studio-core/client';
import {
  deleteLookbookImage,
  deleteLookbookSheet,
  readProjectLookbooks,
} from '@/services/studio-visual-language-api';
import {
  matchesVisualLanguageLookbooksResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { Badge } from '@/ui/badge';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import { EmptyState } from './empty-state';
import { LookbookVisualContentTab } from './lookbook-visual-content-tab';
import { VisualLanguageReport } from './visual-language-report';

interface LookbookPanelProps {
  projectName: string;
  kind: LookbookKind;
}

export function LookbookPanel({
  projectName,
  kind,
}: LookbookPanelProps) {
  const [resource, setResource] = useState<LookbookResource | null>();
  const [resourceRevision, setResourceRevision] = useState(0);

  const refreshLookbook = useCallback(async () => {
    const lookbooks = await readProjectLookbooks(projectName);
    setResource(lookbooks[kind]);
  }, [kind, projectName]);

  useEffect(() => {
    let cancelled = false;
    void readProjectLookbooks(projectName)
      .then((lookbooks) => {
        if (!cancelled) setResource(lookbooks[kind]);
      })
      .catch((error) => toast.error(errorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [projectName, kind, resourceRevision]);

  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) =>
      matchesVisualLanguageLookbooksResource(resourceKeys) ||
      resourceKeys.some((key) =>
        key.startsWith('surface:visual-language:lookbook:')
      ),
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  const removeImage = async (imageId: string) => {
    try {
      await deleteLookbookImage(projectName, imageId);
      await refreshLookbook();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const removeSheet = async (sheetId: string) => {
    try {
      await deleteLookbookSheet(projectName, sheetId);
      await refreshLookbook();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (resource === undefined) {
    return <EmptyState title='Loading Lookbook.' />;
  }

  if (resource === null) {
    return (
      <EmptyState
        title={`${kind === 'production' ? 'Production' : 'Storyboard'} Lookbook has not been authored.`}
      />
    );
  }

  return (
    <LineTabs
      defaultValue='definition'
      items={[
        { value: 'definition', label: 'Definition' },
        {
          value: 'visual',
          label: <span className='inline-flex w-[114px] justify-center'>Assets</span>,
        },
      ]}
    >
      <LineTabsContent value='definition'>
        <VisualLanguageReport
          projectName={projectName}
          title={resource.lookbook.name}
          headerMeta={
            <LookbookHeaderMeta
              type={resource.lookbook.kind}
              sourceInspirationFolders={resource.sourceInspirationFolders}
            />
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
        />
      </LineTabsContent>
    </LineTabs>
  );
}

function LookbookHeaderMeta({
  type,
  sourceInspirationFolders,
}: {
  type: LookbookKind;
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
}) {
  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Badge variant='accent'>{type === 'production' ? 'Production' : 'Storyboard'}</Badge>
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
