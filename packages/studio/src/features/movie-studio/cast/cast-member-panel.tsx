import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import type {
  CastMemberResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import {
  deleteCastAsset,
  readCastAssets,
  selectCastAsset,
  unselectCastAsset,
} from '@/services/studio-project-assets-api';
import { readCastMemberResource } from '@/services/studio-screenplay-api';
import { CastMemberDetailsTab } from './cast-member-details-tab';
import { CastMemberVisualContentTab } from './cast-member-visual-content-tab';

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

  useEffect(() => {
    const handleResourceChanged = (event: Event) => {
      const detail = (event as CustomEvent<StudioResourceChangedDetail>).detail;
      if (!detail || detail.projectName !== projectName) {
        return;
      }
      if (hasCastMemberResourceChange(detail.resourceKeys, castMemberId)) {
        setResourceRevision((current) => current + 1);
      }
    };

    window.addEventListener('renku:studio-resource-changed', handleResourceChanged);
    return () => {
      window.removeEventListener('renku:studio-resource-changed', handleResourceChanged);
    };
  }, [castMemberId, projectName]);

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
        { value: 'visual', label: 'Visual Content' },
        { value: 'voice', label: 'Voice Design' },
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
      <LineTabsContent value='visual'>
        <CastMemberVisualContentTab
          projectName={projectName}
          castMemberId={castMemberId}
          assets={assets}
          onTogglePick={togglePick}
          onDeleteAsset={removeAsset}
        />
      </LineTabsContent>
      <LineTabsContent value='voice' className='p-4 text-sm text-muted-foreground'>
        Voice design will appear here when project assets are attached.
      </LineTabsContent>
    </LineTabs>
  );
}

interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}

function hasCastMemberResourceChange(
  resourceKeys: string[],
  castMemberId: string
): boolean {
  return resourceKeys.some(
    (resourceKey) =>
      resourceKey === `assets:castMember:${castMemberId}` ||
      resourceKey === `surface:castMember:${castMemberId}`
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Cast member request failed.';
}
