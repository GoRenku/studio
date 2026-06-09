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
  selectCastAsset,
  unselectCastAsset,
} from '@/services/studio-project-assets-api';
import { readCastMemberResource } from '@/services/studio-screenplay-api';
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
      if (asset.selection.kind === 'select') {
        await unselectCastAsset(projectName, castMemberId, asset.assetId);
        await refreshCastMember();
        return;
      }

      const selectedAssetsWithSameRole = assets.filter(
        (candidate) =>
          candidate.role === asset.role &&
          candidate.assetId !== asset.assetId &&
          candidate.selection.kind === 'select'
      );
      await selectCastAsset(projectName, castMemberId, asset.assetId);
      await Promise.all(
        selectedAssetsWithSameRole.map((candidate) =>
          unselectCastAsset(projectName, castMemberId, candidate.assetId)
        )
      );
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
        />
      </LineTabsContent>
      <LineTabsContent value='assets'>
        <CastMemberAssetsTab
          projectName={projectName}
          castMemberId={castMemberId}
          resource={resource}
          assets={assets}
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
