import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type {
  InspirationFolderResource,
  InspirationResource,
} from '@gorenku/studio-core/client';
import {
  deleteInspirationFolder,
  deleteInspirationImage,
  readInspirationFolder,
  readInspirationResource,
  uploadInspirationImages,
} from '@/services/studio-visual-language-api';
import {
  matchesVisualLanguageInspirationResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import { EmptyState } from './empty-state';
import { GrabsTab } from './grabs-tab';
import { InspirationAnalysisTab } from './inspiration-analysis-tab';
import { InspirationFoldersPanel } from './inspiration-folders-panel';

interface InspirationPanelProps {
  projectName: string;
  folderId?: string;
  foldersRevision: number;
  onOpenFolder: (folderId: string) => void;
  onInspirationFoldersChange: () => void;
}

export function InspirationPanel({
  projectName,
  folderId,
  foldersRevision,
  onOpenFolder,
  onInspirationFoldersChange,
}: InspirationPanelProps) {
  const [inspirationResource, setInspirationResource] =
    useState<InspirationResource | null>(null);
  const [resource, setResource] = useState<InspirationFolderResource | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);
  const selectedFolderId = folderId ?? null;

  useEffect(() => {
    let cancelled = false;
    void readInspirationResource(projectName)
      .then((nextResource) => {
        if (cancelled) return;
        setInspirationResource(nextResource);
      })
      .catch((error) => toast.error(errorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [foldersRevision, projectName, resourceRevision]);

  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) =>
      matchesVisualLanguageInspirationResource(resourceKeys, selectedFolderId),
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  useEffect(() => {
    if (!selectedFolderId) {
      return;
    }
    let cancelled = false;
    void readInspirationFolder(projectName, selectedFolderId)
      .then((nextResource) => {
        if (!cancelled) setResource(nextResource);
      })
      .catch((error) => toast.error(errorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [projectName, resourceRevision, selectedFolderId]);

  const selectedFolder = useMemo(
    () =>
      inspirationResource?.folders.items.find(
        (item) => item.folder.id === selectedFolderId
      )?.folder ?? null,
    [inspirationResource, selectedFolderId]
  );

  const uploadImages = async (files: File[]) => {
    if (!selectedFolderId || !files.length) return;
    const nextResource = await uploadInspirationImages(projectName, selectedFolderId, files);
    setResource(nextResource);
    setInspirationResource(await readInspirationResource(projectName));
  };

  const removeImage = async (fileName: string) => {
    if (!selectedFolderId) return;
    const nextResource = await deleteInspirationImage(projectName, selectedFolderId, fileName);
    setResource(nextResource);
    setInspirationResource(await readInspirationResource(projectName));
  };

  const removeFolder = async (deletedFolderId: string) => {
    await deleteInspirationFolder(projectName, deletedFolderId);
    const nextResource = await readInspirationResource(projectName);
    setInspirationResource(nextResource);
    onInspirationFoldersChange();
  };

  return (
    <div className='h-full min-h-0'>
      {!inspirationResource ? (
        <EmptyState title='Loading Inspiration folders.' />
      ) : !selectedFolderId ? (
        <InspirationFoldersPanel
          projectName={projectName}
          resource={inspirationResource}
          onOpenFolder={onOpenFolder}
          onDeleteFolder={removeFolder}
        />
      ) : !selectedFolder ? (
        <EmptyState title='No Inspiration folder selected.' />
      ) : resource && resource.folder.id === selectedFolderId ? (
        <LineTabs
          key={`${selectedFolderId}:${resource.analysis ? 'analysis' : 'grabs'}`}
          defaultValue={resource.analysis ? 'analysis' : 'grabs'}
          className='bg-panel-bg'
          items={[
            { value: 'grabs', label: 'Grabs' },
            { value: 'analysis', label: 'Analysis' },
          ]}
          trailing={
            <h2 className='truncate text-sm font-black text-foreground'>
              {resource.folder.name}
            </h2>
          }
        >
          <LineTabsContent value='grabs'>
            <GrabsTab
              projectName={projectName}
              resource={resource}
              onUpload={uploadImages}
              onDeleteImage={removeImage}
            />
          </LineTabsContent>
          <LineTabsContent value='analysis'>
            <InspirationAnalysisTab projectName={projectName} resource={resource} />
          </LineTabsContent>
        </LineTabs>
      ) : (
        <EmptyState title='Loading Inspiration folder.' />
      )}
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Visual Language request failed.';
}
