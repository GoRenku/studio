import { useState } from 'react';
import type {
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
  SHOT_LOCATION_SHEET_DIALOG_CARD_MIN_WIDTH,
  SHOT_LOCATION_SHEET_DIALOG_CLASS,
} from './scene-shot-reference-layout';

interface SceneShotLocationReferenceRowProps {
  projectName: string;
  group: ShotVideoTakeLocationReferenceGroup;
  onPreview: (images: PreviewImage[]) => void;
  onToggleSheet: (
    locationId: string,
    assetId: string,
    selected: boolean
  ) => Promise<void>;
}

export function SceneShotLocationReferenceRow({
  projectName,
  group,
  onPreview,
  onToggleSheet,
}: SceneShotLocationReferenceRowProps) {
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false);
  const displayedSheet =
    group.environmentSheets.find((sheet) => sheet.selected && sheet.assetId) ??
    group.environmentSheets.find((sheet) => sheet.assetId) ??
    group.environmentSheets[0] ??
    null;

  if (!displayedSheet) {
    return null;
  }

  const hasSheetAlternatives = group.environmentSheets.length > 1;
  const preview = displayedSheet.card.previews[0];
  const imageUrl = locationReferenceImageUrl(
    projectName,
    group.locationId,
    displayedSheet,
    preview
  );
  const previewImages = previewImageUrl(preview, imageUrl);
  const title = hasSheetAlternatives ? group.name : displayedSheet.title;
  const selected = displayedSheet.assetId
    ? displayedSheet.selected
    : displayedSheet.card.included;

  return (
    <>
      <SceneShotReferenceCard
        title={title}
        description={displayedSheet.description ?? undefined}
        imageUrl={imageUrl}
        imageAlt={preview?.alt ?? displayedSheet.title}
        card={displayedSheet.card}
        selected={selected}
        selectable={Boolean(displayedSheet.assetId)}
        selectedActionLabel={`Clear ${displayedSheet.title} selection`}
        unselectedActionLabel={`Select ${displayedSheet.title}`}
        aspectRatio={4 / 3}
        aspectClassName='aspect-[4/3]'
        onOpen={() => {
          if (hasSheetAlternatives) {
            setSheetDialogOpen(true);
            return;
          }
          if (previewImages.length) {
            onPreview(previewImages);
          }
        }}
        onToggleSelected={() =>
          displayedSheet.assetId
            ? onToggleSheet(
                group.locationId,
                displayedSheet.assetId,
                displayedSheet.selected
              )
            : Promise.resolve()
        }
      />
      {hasSheetAlternatives ? (
        <LocationSheetDialog
          projectName={projectName}
          group={group}
          open={sheetDialogOpen}
          onOpenChange={setSheetDialogOpen}
          onPreview={onPreview}
          onToggleSheet={onToggleSheet}
        />
      ) : null}
    </>
  );
}

function LocationSheetDialog({
  projectName,
  group,
  open,
  onOpenChange,
  onPreview,
  onToggleSheet,
}: {
  projectName: string;
  group: ShotVideoTakeLocationReferenceGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreview: (images: PreviewImage[]) => void;
  onToggleSheet: (
    locationId: string,
    assetId: string,
    selected: boolean
  ) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHOT_LOCATION_SHEET_DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle className='truncate text-base normal-case leading-6 tracking-normal'>
            {group.name}
          </DialogTitle>
          <DialogDescription className='sr-only'>
            Select a Location Sheet for this location.
          </DialogDescription>
        </DialogHeader>
        <div className='max-h-[60vh] overflow-y-auto px-5 py-5'>
          <SceneShotReferenceCardGrid
            minCardWidth={SHOT_LOCATION_SHEET_DIALOG_CARD_MIN_WIDTH}
          >
            {group.environmentSheets.map((sheet) => {
              const preview = sheet.card.previews[0];
              const imageUrl = locationReferenceImageUrl(
                projectName,
                group.locationId,
                sheet,
                preview
              );
              const previewImages = previewImageUrl(preview, imageUrl);
              return (
                <SceneShotReferenceCard
                  key={sheet.id}
                  title={sheet.title}
                  description={sheet.description ?? undefined}
                  imageUrl={imageUrl}
                  imageAlt={preview?.alt ?? sheet.title}
                  card={sheet.card}
                  selected={sheet.selected}
                  selectable={Boolean(sheet.assetId)}
                  selectedActionLabel={`Clear ${sheet.title} selection`}
                  unselectedActionLabel={`Select ${sheet.title}`}
                  aspectRatio={4 / 3}
                  aspectClassName='aspect-[4/3]'
                  onOpen={() => {
                    if (previewImages.length) {
                      onPreview(previewImages);
                    }
                  }}
                  onToggleSelected={() =>
                    sheet.assetId
                      ? onToggleSheet(group.locationId, sheet.assetId, sheet.selected)
                      : Promise.resolve()
                  }
                />
              );
            })}
          </SceneShotReferenceCardGrid>
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
