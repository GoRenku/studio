import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import type {
  CastMemberResourceResponse,
  StudioAssetFileResponse,
} from '@/services/studio-project-contracts';
import {
  deleteCastAssetFile,
  deleteCastVoice,
  readCastAssetFiles,
  clearSelectedCastProfile,
  selectCastProfileAssetFile,
  selectDefaultCastVoice,
  type StudioAssetFileCollection,
} from '@/services/studio-project-assets-api';
import {
  readCastMemberResource,
  updateCastMemberVoiceOverStatus,
} from '@/services/studio-continuity-api';
import {
  matchesCastMemberResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { CastMemberAssetFilesTab } from './cast-member-assets-tab';
import { CastMemberDetailsTab } from './cast-member-details-tab';

interface CastMemberPanelProps {
  projectName: string;
  castMemberId: string;
}

export function CastMemberPanel({ projectName, castMemberId }: CastMemberPanelProps) {
  const [resource, setResource] = useState<CastMemberResourceResponse | null>(null);
  const [assetFileCollection, setAssetFileCollection] =
    useState<StudioAssetFileCollection>({ items: [], selectedAssetFileId: null });
  const [error, setError] = useState<string | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);

  const refreshCastMember = useCallback(async () => {
    const [nextResource, nextAssetFiles] = await Promise.all([
      readCastMemberResource(projectName, castMemberId),
      readCastAssetFiles(projectName, castMemberId),
    ]);
    setResource(nextResource);
    setAssetFileCollection(nextAssetFiles);
    setError(null);
  }, [castMemberId, projectName]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      readCastMemberResource(projectName, castMemberId),
      readCastAssetFiles(projectName, castMemberId),
    ])
      .then(([nextResource, nextAssetFiles]) => {
        if (!cancelled) {
          setResource(nextResource);
          setAssetFileCollection(nextAssetFiles);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load cast member.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [castMemberId, projectName, resourceRevision]);

  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) =>
      matchesCastMemberResource(resourceKeys, castMemberId),
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  const togglePick = async (assetFile: StudioAssetFileResponse) => {
    try {
      if (assetFileCollection.selectedAssetFileId === assetFile.id) {
        await clearSelectedCastProfile(projectName, castMemberId);
        await refreshCastMember();
        return;
      }
      await selectCastProfileAssetFile(projectName, castMemberId, assetFile.id);
      await refreshCastMember();
    } catch (selectError) {
      toast.error(errorMessage(selectError));
    }
  };

  const removeAssetFile = async (assetFile: StudioAssetFileResponse) => {
    try {
      await deleteCastAssetFile(projectName, castMemberId, assetFile.id);
      await refreshCastMember();
    } catch (deleteError) {
      toast.error(errorMessage(deleteError));
    }
  };

  const removeVoice = async (
    voice: CastMemberResourceResponse['voices'][number]
  ) => {
    try {
      await deleteCastVoice(projectName, castMemberId, voice.id);
      await refreshCastMember();
    } catch (deleteError) {
      toast.error(errorMessage(deleteError));
    }
  };

  const updateVoiceOver = async (isVoiceOver: boolean) => {
    try {
      const nextResource = await updateCastMemberVoiceOverStatus(
        projectName,
        castMemberId,
        isVoiceOver
      );
      setResource(nextResource);
      await refreshCastMember();
    } catch (updateError) {
      toast.error(errorMessage(updateError));
    }
  };

  const selectVoiceDefault = async (
    voice: CastMemberResourceResponse['voices'][number]
  ) => {
    try {
      await selectDefaultCastVoice(projectName, castMemberId, voice.id);
      await refreshCastMember();
    } catch (selectError) {
      toast.error(errorMessage(selectError));
    }
  };

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading cast member...</p>;
  }

  return (
    <LineTabs
      defaultValue='details'
      items={[
        { value: 'details', label: 'Details' },
        { value: 'assetFiles', label: 'Assets' },
      ]}
    >
      <LineTabsContent value='details'>
        <CastMemberDetailsTab
          projectName={projectName}
          resource={resource}
          assetFiles={assetFileCollection.items}
          selectedProfileAssetFileId={assetFileCollection.selectedAssetFileId}
          onVoiceOverChange={updateVoiceOver}
        />
      </LineTabsContent>
      <LineTabsContent value='assetFiles'>
        <CastMemberAssetFilesTab
          projectName={projectName}
          resource={resource}
          assetFiles={assetFileCollection.items}
          selectedProfileAssetFileId={assetFileCollection.selectedAssetFileId}
          onTogglePick={togglePick}
          onDeleteAssetFile={removeAssetFile}
          onDeleteVoice={removeVoice}
          onSelectDefaultVoice={selectVoiceDefault}
        />
      </LineTabsContent>
    </LineTabs>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Cast member request failed.';
}
