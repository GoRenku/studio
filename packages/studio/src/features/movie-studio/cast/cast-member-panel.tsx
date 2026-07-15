import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import type {
  CastMemberResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import {
  deleteCastAsset,
  deleteCastVoice,
  readCastAssets,
  clearCastProfileDisplayAsset,
  setCastProfileDisplayAsset,
} from '@/services/studio-project-assets-api';
import {
  readCastMemberResource,
  updateCastMemberVoiceOverStatus,
} from '@/services/studio-screenplay-api';
import {
  matchesCastMemberResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { CastMemberAssetsTab } from './cast-member-assets-tab';
import { CastMemberDetailsTab } from './cast-member-details-tab';

interface CastMemberPanelProps {
  projectName: string;
  castMemberId: string;
}

export function CastMemberPanel({ projectName, castMemberId }: CastMemberPanelProps) {
  const [resource, setResource] = useState<CastMemberResourceResponse | null>(null);
  const [assets, setAssets] = useState<StudioAssetResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);

  const refreshCastMember = useCallback(async () => {
    const [nextResource, nextAssets] = await Promise.all([
      readCastMemberResource(projectName, castMemberId),
      readCastAssets(projectName, castMemberId),
    ]);
    setResource(nextResource);
    setAssets(nextAssets);
    setError(null);
  }, [castMemberId, projectName]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      readCastMemberResource(projectName, castMemberId),
      readCastAssets(projectName, castMemberId),
    ])
      .then(([nextResource, nextAssets]) => {
        if (!cancelled) {
          setResource(nextResource);
          setAssets(nextAssets);
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

  const togglePick = async (asset: StudioAssetResponse) => {
    try {
      if (resource?.firstImage?.assetId === asset.assetId) {
        await clearCastProfileDisplayAsset(projectName, castMemberId);
        await refreshCastMember();
        return;
      }
      await setCastProfileDisplayAsset(projectName, castMemberId, asset.assetId);
      await refreshCastMember();
    } catch (selectError) {
      toast.error(errorMessage(selectError));
    }
  };

  const removeAsset = async (asset: StudioAssetResponse) => {
    try {
      await deleteCastAsset(projectName, castMemberId, asset.assetId);
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
        { value: 'assets', label: 'Assets' },
      ]}
    >
      <LineTabsContent value='details'>
        <CastMemberDetailsTab
          projectName={projectName}
          castMemberId={castMemberId}
          resource={resource}
          assets={assets}
          onVoiceOverChange={updateVoiceOver}
        />
      </LineTabsContent>
      <LineTabsContent value='assets'>
        <CastMemberAssetsTab
          projectName={projectName}
          castMemberId={castMemberId}
          resource={resource}
          assets={assets}
          displayProfileAssetId={resource.firstImage?.assetId ?? null}
          onTogglePick={togglePick}
          onDeleteAsset={removeAsset}
          onDeleteVoice={removeVoice}
        />
      </LineTabsContent>
    </LineTabs>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Cast member request failed.';
}
