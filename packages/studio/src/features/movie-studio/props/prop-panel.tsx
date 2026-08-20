import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  clearSelectedPropHero,
  deletePropAsset,
  readPropAssets,
  selectPropHeroAsset,
} from '@/services/studio-project-assets-api';
import { readPropResource } from '@/services/studio-continuity-api';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import {
  matchesPropResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { useSelectableAssetCollection } from '@/hooks/use-selectable-asset-collection';
import { useContinuityResource } from '../continuity/use-continuity-resource';
import { PropAssetsTab } from './prop-assets-tab';
import { PropDetailsTab } from './prop-details-tab';

export function PropPanel({
  projectName,
  propId,
}: {
  projectName: string;
  propId: string;
}) {
  const readResource = useCallback(
    () => readPropResource(projectName, propId),
    [projectName, propId]
  );
  const {
    resource,
    error: resourceError,
    refresh: refreshResource,
  } = useContinuityResource({
    read: readResource,
    fallbackErrorMessage: 'Unable to load prop.',
  });
  const readAssets = useCallback(
    () => readPropAssets(projectName, propId),
    [projectName, propId]
  );
  const selectHero = useCallback(
    (assetId: string) => selectPropHeroAsset(projectName, propId, assetId),
    [projectName, propId]
  );
  const clearHero = useCallback(
    () => clearSelectedPropHero(projectName, propId),
    [projectName, propId]
  );
  const discard = useCallback(
    (assetId: string) => deletePropAsset(projectName, propId, assetId),
    [projectName, propId]
  );
  const assets = useSelectableAssetCollection({
    readAssets,
    selectCanonicalAsset: selectHero,
    clearCanonicalAsset: clearHero,
    discardAsset: discard,
  });

  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) => matchesPropResource(resourceKeys, propId),
    onRefresh: async () => {
      await Promise.all([refreshResource(), assets.refresh()]);
    },
  });

  const handleToggle = useCallback(
    async (asset: Parameters<typeof assets.toggleCanonical>[0]) => {
      try {
        await assets.toggleCanonical(asset);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to update prop hero.');
      }
    },
    [assets]
  );
  const handleDelete = useCallback(
    async (asset: Parameters<typeof assets.remove>[0]) => {
      try {
        await assets.remove(asset);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to delete prop asset.');
      }
    },
    [assets]
  );

  const error = resourceError ?? assets.error;
  if (error) return <p className='text-sm text-destructive'>{error}</p>;
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading prop...</p>;
  }

  return (
    <LineTabs
      defaultValue='details'
      className='flex min-h-0 flex-1 flex-col'
      items={[
        { value: 'details', label: 'Details' },
        { value: 'assets', label: 'Assets' },
      ]}
    >
      <LineTabsContent value='details' className='min-h-0 flex-1'>
        <PropDetailsTab
          projectName={projectName}
          resource={resource}
          assets={assets.collection.items}
          selectedHeroAssetId={assets.collection.selectedAssetId}
        />
      </LineTabsContent>
      <LineTabsContent value='assets' className='min-h-0 flex-1'>
        <PropAssetsTab
          projectName={projectName}
          assets={assets.collection.items}
          selectedHeroAssetId={assets.collection.selectedAssetId}
          onToggleHero={handleToggle}
          onDeleteAsset={handleDelete}
        />
      </LineTabsContent>
    </LineTabs>
  );
}
