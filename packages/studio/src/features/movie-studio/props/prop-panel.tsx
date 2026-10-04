import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  clearSelectedPropHero,
  deletePropAssetFile,
  readPropAssetFiles,
  selectPropHeroAssetFile,
} from '@/services/studio-project-assets-api';
import { readPropResource } from '@/services/studio-continuity-api';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import {
  matchesPropResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { useSelectableAssetFileCollection } from '@/hooks/use-selectable-asset-collection';
import { useContinuityResource } from '../continuity/use-continuity-resource';
import { PropAssetFilesTab } from './prop-assets-tab';
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
  const readAssetFiles = useCallback(
    () => readPropAssetFiles(projectName, propId),
    [projectName, propId]
  );
  const selectHero = useCallback(
    (assetFileId: string) => selectPropHeroAssetFile(projectName, propId, assetFileId),
    [projectName, propId]
  );
  const clearHero = useCallback(
    () => clearSelectedPropHero(projectName, propId),
    [projectName, propId]
  );
  const discard = useCallback(
    (assetFileId: string) => deletePropAssetFile(projectName, propId, assetFileId),
    [projectName, propId]
  );
  const assetFiles = useSelectableAssetFileCollection({
    readAssetFiles,
    selectCanonicalAssetFile: selectHero,
    clearCanonicalAssetFile: clearHero,
    discardAssetFile: discard,
  });

  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) => matchesPropResource(resourceKeys, propId),
    onRefresh: async () => {
      await Promise.all([refreshResource(), assetFiles.refresh()]);
    },
  });

  const handleToggle = useCallback(
    async (assetFile: Parameters<typeof assetFiles.toggleCanonical>[0]) => {
      try {
        await assetFiles.toggleCanonical(assetFile);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to update prop hero.');
      }
    },
    [assetFiles]
  );
  const handleDelete = useCallback(
    async (assetFile: Parameters<typeof assetFiles.remove>[0]) => {
      try {
        await assetFiles.remove(assetFile);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unable to delete prop asset.');
      }
    },
    [assetFiles]
  );

  const error = resourceError ?? assetFiles.error;
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
        { value: 'assetFiles', label: 'AssetFiles' },
      ]}
    >
      <LineTabsContent value='details' className='min-h-0 flex-1'>
        <PropDetailsTab
          projectName={projectName}
          resource={resource}
          assetFiles={assetFiles.collection.items}
          selectedHeroAssetFileId={assetFiles.collection.selectedAssetFileId}
        />
      </LineTabsContent>
      <LineTabsContent value='assetFiles' className='min-h-0 flex-1'>
        <PropAssetFilesTab
          projectName={projectName}
          assetFiles={assetFiles.collection.items}
          selectedHeroAssetFileId={assetFiles.collection.selectedAssetFileId}
          onToggleHero={handleToggle}
          onDeleteAssetFile={handleDelete}
        />
      </LineTabsContent>
    </LineTabs>
  );
}
