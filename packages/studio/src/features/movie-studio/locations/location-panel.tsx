import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LineTabs, LineTabsContent } from '@/ui/line-tabs';
import type { LocationResourceResponse } from '@/services/studio-project-contracts';
import {
  deleteLocationAssetFile,
  clearSelectedLocationHero,
  readLocationAssetFiles,
  selectLocationHeroAssetFile,
} from '@/services/studio-project-assets-api';
import { readLocationResource } from '@/services/studio-continuity-api';
import {
  matchesLocationResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { LocationDetailsTab } from './location-details-tab';
import { LocationVisualContentTab } from './location-visual-content-tab';
import { LocationWorldTab } from './location-world-tab';
import { useSelectableAssetFileCollection } from '@/hooks/use-selectable-asset-collection';

interface LocationPanelProps {
  projectName: string;
  locationId: string;
}

export function LocationPanel({ projectName, locationId }: LocationPanelProps) {
  const [resource, setResource] = useState<LocationResourceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);
  const assetFiles = useSelectableAssetFileCollection({
    readAssetFiles: useCallback(
      () => readLocationAssetFiles(projectName, locationId),
      [locationId, projectName]
    ),
    selectCanonicalAssetFile: useCallback(
      (assetFileId: string) =>
        selectLocationHeroAssetFile(projectName, locationId, assetFileId),
      [locationId, projectName]
    ),
    clearCanonicalAssetFile: useCallback(
      () => clearSelectedLocationHero(projectName, locationId),
      [locationId, projectName]
    ),
    discardAssetFile: useCallback(
      (assetFileId: string) => deleteLocationAssetFile(projectName, locationId, assetFileId),
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
      return assetFiles.refresh();
    },
  });

  const removeAssetFile = async (assetFile: Parameters<typeof assetFiles.remove>[0]) => {
    try {
      await assetFiles.remove(assetFile);
    } catch (deleteError) {
      toast.error(errorMessage(deleteError));
    }
  };

  const toggleHeroDisplay = async (
    assetFile: Parameters<typeof assetFiles.toggleCanonical>[0]
  ) => {
    try {
      await assetFiles.toggleCanonical(assetFile);
    } catch (displayError) {
      toast.error(errorMessage(displayError));
    }
  };

  if (error ?? assetFiles.error) {
    return <p className='text-sm text-destructive'>{error ?? assetFiles.error}</p>;
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
          assetFiles={assetFiles.collection.items}
          selectedHeroAssetFileId={assetFiles.collection.selectedAssetFileId}
        />
      </LineTabsContent>
      <LineTabsContent value='visual'>
        <LocationVisualContentTab
          projectName={projectName}
          assetFiles={assetFiles.collection.items}
          selectedHeroAssetFileId={assetFiles.collection.selectedAssetFileId}
          onToggleHeroDisplay={toggleHeroDisplay}
          onDeleteAssetFile={removeAssetFile}
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
