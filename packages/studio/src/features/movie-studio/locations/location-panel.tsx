import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import type { LocationResourceResponse } from '@/services/studio-project-contracts';
import {
  deleteLocationAsset,
  clearSelectedLocationHero,
  readLocationAssets,
  selectLocationHeroAsset,
} from '@/services/studio-project-assets-api';
import { readLocationResource } from '@/services/studio-continuity-api';
import {
  matchesLocationResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { LocationDetailsTab } from './location-details-tab';
import { LocationVisualContentTab } from './location-visual-content-tab';
import { LocationWorldTab } from './location-world-tab';
import { useContinuityAssets } from '../continuity/use-continuity-assets';

interface LocationPanelProps {
  projectName: string;
  locationId: string;
}

export function LocationPanel({ projectName, locationId }: LocationPanelProps) {
  const [resource, setResource] = useState<LocationResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);
  const assets = useContinuityAssets({
    readAssets: useCallback(
      () => readLocationAssets(projectName, locationId),
      [locationId, projectName]
    ),
    selectCanonicalAsset: useCallback(
      (assetId: string) =>
        selectLocationHeroAsset(projectName, locationId, assetId),
      [locationId, projectName]
    ),
    clearCanonicalAsset: useCallback(
      () => clearSelectedLocationHero(projectName, locationId),
      [locationId, projectName]
    ),
    discardAsset: useCallback(
      (assetId: string) => deleteLocationAsset(projectName, locationId, assetId),
      [locationId, projectName]
    ),
  });

  useEffect(() => {
    let cancelled = false;
    void readLocationResource(projectName, locationId)
      .then((nextResource) => {
        if (!cancelled) {
          setResource(nextResource);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load location.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [locationId, projectName, resourceRevision]);

  useStudioResourceRefresh({
    projectName,
    matches: (resourceKeys) => matchesLocationResource(resourceKeys, locationId),
    onRefresh: () => {
      setResourceRevision((current) => current + 1);
      return assets.refresh();
    },
  });

  const removeAsset = async (asset: Parameters<typeof assets.remove>[0]) => {
    try {
      await assets.remove(asset);
    } catch (deleteError) {
      toast.error(errorMessage(deleteError));
    }
  };

  const toggleHeroDisplay = async (
    asset: Parameters<typeof assets.toggleCanonical>[0]
  ) => {
    try {
      await assets.toggleCanonical(asset);
    } catch (displayError) {
      toast.error(errorMessage(displayError));
    }
  };

  if (error ?? assets.error) {
    return <p className='text-sm text-destructive'>{error ?? assets.error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading location...</p>;
  }

  return (
    <LineTabs
      defaultValue='details'
      items={[
        { value: 'details', label: 'Details' },
        {
          value: 'visual',
          label: <span className='inline-flex w-[114px] justify-center'>Assets</span>,
        },
        { value: 'world', label: '3D World' },
      ]}
    >
      <LineTabsContent value='details'>
        <LocationDetailsTab
          projectName={projectName}
          resource={resource}
          assets={assets.collection.items}
          selectedHeroAssetId={assets.collection.selectedAssetId}
        />
      </LineTabsContent>
      <LineTabsContent value='visual'>
        <LocationVisualContentTab
          projectName={projectName}
          assets={assets.collection.items}
          selectedHeroAssetId={assets.collection.selectedAssetId}
          onToggleHeroDisplay={toggleHeroDisplay}
          onDeleteAsset={removeAsset}
        />
      </LineTabsContent>
      <LineTabsContent value='world' className='h-full overflow-hidden'>
        <LocationWorldTab
          projectName={projectName}
          world={resource.selectedWorld}
        />
      </LineTabsContent>
    </LineTabs>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Location request failed.';
}
