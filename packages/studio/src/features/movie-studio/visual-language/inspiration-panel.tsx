import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type {
  InspirationFolder,
  InspirationFolderResource,
} from '@gorenku/studio-core/client';
import {
  deleteInspirationImage,
  readInspirationFolder,
  readInspirationResource,
  uploadInspirationImages,
} from '@/services/studio-visual-language-api';
import { LineTabBar } from '@/ui/line-tab-bar';
import { Tabs, TabsContent } from '@/ui/tabs';
import { EmptyState } from './empty-state';
import { GrabsTab } from './grabs-tab';
import { InspirationAnalysisTab } from './inspiration-analysis-tab';

interface InspirationPanelProps {
  projectName: string;
  folderId?: string;
  foldersRevision: number;
}

export function InspirationPanel({
  projectName,
  folderId,
  foldersRevision,
}: InspirationPanelProps) {
  const [folders, setFolders] = useState<InspirationFolder[] | null>(null);
  const [resource, setResource] = useState<InspirationFolderResource | null>(null);
  const selectedFolderId = folderId ?? folders?.[0]?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    void readInspirationResource(projectName)
      .then((nextResource) => {
        if (cancelled) return;
        setFolders(nextResource.folders.items);
      })
      .catch((error) => toast.error(errorMessage(error)));
    return () => {
      cancelled = true;
    };
  }, [foldersRevision, projectName]);

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
  }, [projectName, selectedFolderId]);

  const selectedFolder = useMemo(
    () => folders?.find((folder) => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId]
  );

  const uploadImages = async (files: File[]) => {
    if (!selectedFolderId || !files.length) return;
    const nextResource = await uploadInspirationImages(projectName, selectedFolderId, files);
    setResource(nextResource);
  };

  const removeImage = async (fileName: string) => {
    if (!selectedFolderId) return;
    const nextResource = await deleteInspirationImage(projectName, selectedFolderId, fileName);
    setResource(nextResource);
  };

  return (
    <div className='h-full min-h-0'>
      {!folders ? (
        <EmptyState title='Loading Inspiration folders.' />
      ) : !selectedFolder ? (
        <EmptyState title='No Inspiration folder selected.' />
      ) : resource && resource.folder.id === selectedFolderId ? (
        <Tabs defaultValue='grabs' className='h-full gap-0'>
          <LineTabBar
            items={[
              { value: 'grabs', label: 'Grabs' },
              { value: 'analysis', label: 'Analysis' },
            ]}
          />
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Visual Language request failed.';
}
