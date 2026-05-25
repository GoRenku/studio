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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';
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

  useEffect(() => {
    const handleResourceChanged = (event: Event) => {
      const detail = (event as CustomEvent<StudioResourceChangedDetail>).detail;
      if (!detail || detail.projectName !== projectName) {
        return;
      }
      const hasInspirationChange = detail.resourceKeys.some(
        (resourceKey) =>
          resourceKey === 'surface:visual-language:inspiration' ||
          resourceKey === `surface:visual-language:inspiration:${selectedFolderId}`
      );
      if (hasInspirationChange) {
        setResourceRevision((current) => current + 1);
      }
    };

    window.addEventListener('renku:studio-resource-changed', handleResourceChanged);
    return () => {
      window.removeEventListener('renku:studio-resource-changed', handleResourceChanged);
    };
  }, [projectName, selectedFolderId]);

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
        <Tabs
          key={`${selectedFolderId}:${resource.analysis ? 'analysis' : 'grabs'}`}
          defaultValue={resource.analysis ? 'analysis' : 'grabs'}
          className='h-full gap-0 bg-panel-bg'
        >
          <div className='shrink-0 border-b border-border/40 bg-sidebar-header-bg px-5 py-3 sm:px-8'>
            <div className='mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3'>
              <div className='min-w-0'>
                <h2 className='truncate text-lg font-black text-foreground'>
                  {resource.folder.name}
                </h2>
              </div>
              <TabsList
                variant='line'
                className='h-10 rounded-none bg-transparent p-0 text-muted-foreground'
              >
                <TabsTrigger
                  value='grabs'
                  className='h-10 rounded-none border-0 px-4 text-sm font-semibold text-muted-foreground data-[state=active]:bg-item-active-bg data-[state=active]:text-foreground data-[state=active]:after:bg-primary'
                >
                  Grabs
                </TabsTrigger>
                <TabsTrigger
                  value='analysis'
                  className='h-10 rounded-none border-0 px-4 text-sm font-semibold text-muted-foreground data-[state=active]:bg-item-active-bg data-[state=active]:text-foreground data-[state=active]:after:bg-primary'
                >
                  Analysis
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
          <TabsContent value='grabs' className='min-h-0 overflow-y-auto p-0'>
            <GrabsTab
              projectName={projectName}
              resource={resource}
              onUpload={uploadImages}
              onDeleteImage={removeImage}
            />
          </TabsContent>
          <TabsContent value='analysis' className='min-h-0 overflow-y-auto p-0'>
            <InspirationAnalysisTab projectName={projectName} resource={resource} />
          </TabsContent>
        </Tabs>
      ) : (
        <EmptyState title='Loading Inspiration folder.' />
      )}
    </div>
  );
}

interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Visual Language request failed.';
}
