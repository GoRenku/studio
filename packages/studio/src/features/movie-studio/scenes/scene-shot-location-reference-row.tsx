import { useState } from 'react';
import type {
  LocationAzimuthViewId,
  ShotVideoTakeEnvironmentSheetReferenceChoice,
  ShotVideoTakeLocationReferenceGroup,
} from '@gorenku/studio-core/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { locationAssetFileUrl } from '@/services/studio-project-assets-api';
import type { PreviewImage } from '@/ui/image-preview-dialog';
import { previewImageUrl } from './scene-shot-reference-card-images';
import { SceneShotReferenceCard } from './scene-shot-reference-card';
import { SceneShotReferenceCardGrid } from './scene-shot-reference-card-grid';
import {
  SHOT_LOCATION_VIEW_DIALOG_CARD_MIN_WIDTH,
  SHOT_LOCATION_VIEW_DIALOG_CLASS,
} from './scene-shot-reference-layout';

interface SceneShotLocationReferenceRowProps {
  projectName: string;
  group: ShotVideoTakeLocationReferenceGroup;
  onPreview: (images: PreviewImage[]) => void;
  onToggleInclusion: (
    dependencyId: string,
    inclusion: 'include' | 'exclude' | null
  ) => Promise<void>;
  onToggleView: (
    locationId: string,
    assetId: string,
    viewId: LocationAzimuthViewId,
    selected: boolean
  ) => Promise<void>;
}

export function SceneShotLocationReferenceRow({
  projectName,
  group,
  onPreview,
  onToggleInclusion,
  onToggleView,
}: SceneShotLocationReferenceRowProps) {
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const selectedSheet =
    group.environmentSheets.find((sheet) => sheet.selected) ??
    group.environmentSheets[0] ??
    null;

  if (!selectedSheet) {
    return null;
  }

  const sheetPreview = selectedSheet.card.previews[0];
  const sheetImageUrl = locationReferenceImageUrl(
    projectName,
    group.locationId,
    selectedSheet,
    sheetPreview
  );

  return (
    <>
      <SceneShotReferenceCard
        title={group.name}
        imageUrl={sheetImageUrl}
        imageAlt={group.name}
        card={selectedSheet.card}
        selected={selectedSheet.card.included}
        controlMode='inclusion'
        aspectRatio={4 / 3}
        aspectClassName='aspect-[4/3]'
        onOpen={() => setViewDialogOpen(true)}
        onToggleSelected={() =>
          selectedSheet.card.dependencyId
            ? onToggleInclusion(
                selectedSheet.card.dependencyId,
                nextReferenceInclusion(selectedSheet.card)
              )
            : Promise.resolve()
        }
      />
      <LocationViewDialog
        projectName={projectName}
        group={group}
        sheet={selectedSheet}
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        onPreview={onPreview}
        onToggleView={onToggleView}
      />
    </>
  );
}

function nextReferenceInclusion(card: {
  defaultIncluded: boolean;
  included: boolean;
}): 'include' | 'exclude' | null {
  if (card.included) {
    return card.defaultIncluded ? 'exclude' : null;
  }
  return card.defaultIncluded ? null : 'include';
}

function LocationViewDialog({
  projectName,
  group,
  sheet,
  open,
  onOpenChange,
  onPreview,
  onToggleView,
}: {
  projectName: string;
  group: ShotVideoTakeLocationReferenceGroup;
  sheet: ShotVideoTakeEnvironmentSheetReferenceChoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreview: (images: PreviewImage[]) => void;
  onToggleView: (
    locationId: string,
    assetId: string,
    viewId: LocationAzimuthViewId,
    selected: boolean
  ) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHOT_LOCATION_VIEW_DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle className='truncate text-base normal-case leading-6 tracking-normal'>
            {group.name}
          </DialogTitle>
          <DialogDescription className='sr-only'>
            Select location views for this shot.
          </DialogDescription>
        </DialogHeader>
        <div className='max-h-[60vh] overflow-y-auto px-5 py-5'>
          {sheet.views.length ? (
            <SceneShotReferenceCardGrid
              minCardWidth={SHOT_LOCATION_VIEW_DIALOG_CARD_MIN_WIDTH}
            >
              {sheet.views.map((view) => {
                const preview = view.card.previews[0];
                const imageUrl = locationReferenceImageUrl(
                  projectName,
                  group.locationId,
                  sheet,
                  preview
                );
                const previewImages = previewImageUrl(preview, imageUrl);
                return (
                  <SceneShotReferenceCard
                    key={view.id}
                    title={view.label}
                    imageUrl={imageUrl}
                    imageAlt={preview?.alt ?? view.label}
                    card={view.card}
                    selected={view.selected}
                    aspectRatio={16 / 9}
                    aspectClassName='aspect-video'
                    onOpen={() => {
                      if (previewImages.length) {
                        onPreview(previewImages);
                      }
                    }}
                    onToggleSelected={() =>
                      sheet.assetId
                        ? onToggleView(
                            group.locationId,
                            sheet.assetId,
                            view.viewId,
                            view.selected
                          )
                        : Promise.resolve()
                    }
                  />
                );
              })}
            </SceneShotReferenceCardGrid>
          ) : (
            <p className='text-sm text-muted-foreground'>
              No location views are available for this sheet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function locationReferenceImageUrl(
  projectName: string,
  locationId: string,
  sheet: ShotVideoTakeEnvironmentSheetReferenceChoice,
  preview: ShotVideoTakeEnvironmentSheetReferenceChoice['card']['previews'][number] | undefined
): string | null {
  if (!preview || !sheet.assetId) {
    return null;
  }
  return locationAssetFileUrl(
    projectName,
    locationId,
    preview.assetId,
    preview.assetFileId
  );
}
