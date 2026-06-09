import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import type {
  LocationResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import {
  deleteLocationAsset,
  readLocationAssets,
  selectLocationAsset,
  unselectLocationAsset,
} from '@/services/studio-project-assets-api';
import { readLocationResource } from '@/services/studio-screenplay-api';
import {
  matchesLocationResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { LOCATION_ENVIRONMENT_SHEET_ROLE } from './location-assets';
import { LocationDetailsTab } from './location-details-tab';
import { LocationVisualContentTab } from './location-visual-content-tab';

interface LocationPanelProps {
  projectName: string;
  locationId: string;
}

export function LocationPanel({ projectName, locationId }: LocationPanelProps) {
  const [resource, setResource] = useState<LocationResourceResponse | null>(null);
  const [assets, setAssets] = useState<StudioAssetResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);

  const refreshLocation = useCallback(async () => {
    const [nextResource, nextAssets] = await Promise.all([
      readLocationResource(projectName, locationId),
      readLocationAssets(projectName, locationId),
    ]);
    setResource(nextResource);
    setAssets(nextAssets);
    setError(null);
  }, [locationId, projectName]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      readLocationResource(projectName, locationId),
      readLocationAssets(projectName, locationId),
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
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  const toggleActive = async (asset: StudioAssetResponse) => {
    try {
      if (asset.selection.kind === 'select') {
        await unselectLocationAsset(projectName, locationId, asset.assetId);
        await refreshLocation();
        return;
      }

      const selectedEnvironmentSheets = assets.filter(
        (candidate) =>
          candidate.role === LOCATION_ENVIRONMENT_SHEET_ROLE &&
          candidate.assetId !== asset.assetId &&
          candidate.selection.kind === 'select'
      );
      await selectLocationAsset(projectName, locationId, asset.assetId);
      await Promise.all(
        selectedEnvironmentSheets.map((candidate) =>
          unselectLocationAsset(projectName, locationId, candidate.assetId)
        )
      );
      await refreshLocation();
    } catch (selectError) {
      toast.error(errorMessage(selectError));
    }
  };

  const removeAsset = async (asset: StudioAssetResponse) => {
    try {
      await deleteLocationAsset(projectName, locationId, asset.assetId);
      await refreshLocation();
    } catch (deleteError) {
      toast.error(errorMessage(deleteError));
    }
  };

  if (error) {
    return <p className='text-sm text-destructive'>{error}</p>;
  }
  if (!resource) {
    return <p className='text-sm text-muted-foreground'>Loading location...</p>;
  }

  return (
    <LineTabs
      defaultValue='details'
      items={[
        { value: 'details', label: 'Details' },
        { value: 'visual', label: 'Visual Content' },
      ]}
    >
      <LineTabsContent value='details'>
        <LocationDetailsTab
          projectName={projectName}
          locationId={locationId}
          resource={resource}
          assets={assets}
        />
      </LineTabsContent>
      <LineTabsContent value='visual'>
        <LocationVisualContentTab
          projectName={projectName}
          locationId={locationId}
          assets={assets}
          onToggleActive={toggleActive}
          onDeleteAsset={removeAsset}
        />
      </LineTabsContent>
    </LineTabs>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Location request failed.';
}
