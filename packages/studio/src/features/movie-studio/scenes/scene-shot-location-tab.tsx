import { useEffect, useMemo, useState } from 'react';
import { ImageOff } from 'lucide-react';
import type {
  LocationAzimuthViewId,
  SceneShot,
} from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import { Switch } from '@/ui/switch';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { readLocationAssets } from '@/services/studio-project-assets-api';
import { cn } from '@/lib/utils';
import {
  CustomFieldRow,
  DesignSection,
  PillToggle,
} from './scene-shot-design-controls';
import { projectShotLocationAssets } from './scene-shot-location-assets';
import { useShotSpecsContext } from './shot-specs-context';

interface SceneShotLocationTabProps {
  projectName: string;
  shot: SceneShot;
  locationLabels: Record<string, string>;
}

export function SceneShotLocationTab({
  projectName,
  shot,
  locationLabels,
}: SceneShotLocationTabProps) {
  const { shotSpecs, update, status } = useShotSpecsContext();
  const [assetSet, setAssetSet] = useState<ShotLocationAssetSet>({
    locationId: null,
    assets: [],
  });
  const [assetError, setAssetError] = useState<string | null>(null);
  const [assetRevision, setAssetRevision] = useState(0);
  const locationSpecs = shotSpecs.location ?? {};
  const usesDifferentLocation = locationSpecs.usesDifferentLocation === true;
  const selectableLocationIds = usesDifferentLocation
    ? Object.keys(locationLabels)
    : shot.locationIds;
  const selectedLocationId =
    locationSpecs.locationId ?? selectableLocationIds[0] ?? shot.locationIds[0];

  useEffect(() => {
    if (!selectedLocationId) {
      return;
    }
    let cancelled = false;
    void readLocationAssets(projectName, selectedLocationId)
      .then((nextAssets) => {
        if (!cancelled) {
          setAssetSet({ locationId: selectedLocationId, assets: nextAssets });
          setAssetError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAssetSet({ locationId: selectedLocationId, assets: [] });
          setAssetError(
            error instanceof Error ? error.message : 'Unable to load location assets.'
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [assetRevision, projectName, selectedLocationId]);

  useEffect(() => {
    const handleResourceChanged = (event: Event) => {
      const detail = (event as CustomEvent<StudioResourceChangedDetail>).detail;
      if (!detail || detail.projectName !== projectName || !selectedLocationId) {
        return;
      }
      if (
        detail.resourceKeys.some(
          (resourceKey) =>
            resourceKey === `assets:location:${selectedLocationId}` ||
            resourceKey === `surface:location:${selectedLocationId}`
        )
      ) {
        setAssetRevision((current) => current + 1);
      }
    };

    window.addEventListener('renku:studio-resource-changed', handleResourceChanged);
    return () => {
      window.removeEventListener(
        'renku:studio-resource-changed',
        handleResourceChanged
      );
    };
  }, [projectName, selectedLocationId]);

  const projection = useMemo(
    () =>
      projectShotLocationAssets({
        projectName,
        selectedLocationId,
        locationLabels,
        assets:
          assetSet.locationId === selectedLocationId ? assetSet.assets : [],
      }),
    [assetSet, locationLabels, projectName, selectedLocationId]
  );

  const setLocationId = (locationId: string) =>
    update({
      ...shotSpecs,
      location: { ...locationSpecs, locationId },
    });

  const setUsesDifferentLocation = (checked: boolean) => {
    const nextLocationId = checked
      ? selectedLocationId
      : shot.locationIds.includes(selectedLocationId ?? '')
        ? selectedLocationId
        : shot.locationIds[0];
    update({
      ...shotSpecs,
      location: {
        ...locationSpecs,
        locationId: nextLocationId,
        usesDifferentLocation: checked ? true : undefined,
      },
    });
  };

  const toggleAzimuthView = (viewId: LocationAzimuthViewId) =>
    update({
      ...shotSpecs,
      location: {
        ...locationSpecs,
        locationId: selectedLocationId,
        azimuthView:
          locationSpecs.azimuthView === viewId ? undefined : viewId,
        customView: undefined,
      },
    });

  const setCustomView = (customView: string) =>
    update({
      ...shotSpecs,
      location: {
        ...locationSpecs,
        locationId: selectedLocationId,
        azimuthView: undefined,
        customView,
      },
    });

  return (
    <div className='space-y-6 py-4'>
      <DesignSection title='Shot Location'>
        <div className='flex flex-wrap gap-2'>
          {selectableLocationIds.map((locationId) => (
            <PillToggle
              key={locationId}
              selected={selectedLocationId === locationId}
              onClick={() => setLocationId(locationId)}
            >
              {locationLabels[locationId] ?? 'Location'}
            </PillToggle>
          ))}
        </div>
      </DesignSection>

      <DesignSection title='Different Location'>
        <div className='flex items-center gap-3'>
          <Switch
            checked={usesDifferentLocation}
            onCheckedChange={setUsesDifferentLocation}
            aria-label='Use a different location'
          />
          <span className='text-sm font-medium text-foreground/80'>
            Use another project location
          </span>
        </div>
      </DesignSection>

      <DesignSection title='Environment Sheet Views'>
        {assetError && selectedLocationId ? (
          <p className='text-sm text-destructive'>{assetError}</p>
        ) : null}
        <div className='grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3'>
          {projection.viewImages.map((view) => (
            <Button
              key={view.id}
              type='button'
              variant={null}
              size={null}
              disabled={!view.selectable}
              aria-pressed={locationSpecs.azimuthView === view.id}
              onClick={() => toggleAzimuthView(view.id)}
              className={cn(
                'group flex flex-col gap-2 rounded-md border bg-muted/20 p-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-55',
                locationSpecs.azimuthView === view.id
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-border/50 hover:border-border'
              )}
            >
              <span className='flex aspect-video w-full items-center justify-center overflow-hidden rounded-sm bg-background/60'>
                {view.src ? (
                  <img
                    src={view.src}
                    alt={`${view.label} location view`}
                    className='h-full w-full object-cover'
                    loading='lazy'
                  />
                ) : (
                  <ImageOff className='h-5 w-5 text-muted-foreground/50' />
                )}
              </span>
              <span className='text-center text-[11px] font-medium text-foreground/80'>
                {view.label}
              </span>
            </Button>
          ))}
        </div>
      </DesignSection>

      <DesignSection title='Custom View'>
        <CustomFieldRow
          placeholder='Custom view...'
          value={locationSpecs.customView ?? ''}
          onChange={setCustomView}
          status={status}
        />
      </DesignSection>
    </div>
  );
}

interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}

interface ShotLocationAssetSet {
  locationId: string | null;
  assets: StudioAssetResponse[];
}
