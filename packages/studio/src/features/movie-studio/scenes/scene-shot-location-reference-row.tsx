import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type {
  LocationAzimuthViewId,
  ShotVideoTakeLocationReferenceGroup,
} from '@gorenku/studio-core/client';
import { cn } from '@/lib/utils';
import { Button } from '@/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/ui/collapsible';
import { locationAssetFileUrl } from '@/services/studio-project-assets-api';
import type { PreviewImage } from '@/ui/image-preview-dialog';
import { previewImageUrl } from './scene-shot-reference-card-images';
import { SceneShotReferenceCard } from './scene-shot-reference-card';
import { SceneShotReferenceCardRow } from './scene-shot-reference-card-grid';

interface SceneShotLocationReferenceRowProps {
  projectName: string;
  group: ShotVideoTakeLocationReferenceGroup;
  onPreview: (images: PreviewImage[]) => void;
  onSelectLocation: (locationId: string) => Promise<void>;
  onSelectSheet: (locationId: string, assetId: string | null) => Promise<void>;
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
  onSelectLocation,
  onSelectSheet,
  onToggleView,
}: SceneShotLocationReferenceRowProps) {
  const [open, setOpen] = useState(false);
  const selectedSheet =
    group.environmentSheets.find((sheet) => sheet.selected) ??
    group.environmentSheets[0] ??
    null;

  if (!selectedSheet) {
    return null;
  }

  const sheetPreview = selectedSheet.card.previews[0];
  const sheetImageUrl =
    sheetPreview && selectedSheet.assetId
      ? locationAssetFileUrl(
          projectName,
          group.locationId,
          sheetPreview.assetId,
          sheetPreview.assetFileId
        )
      : null;
  const sheetPreviewImages = previewImageUrl(sheetPreview, sheetImageUrl);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className='grid grid-cols-[minmax(220px,280px)_2.5rem] gap-2'>
        <SceneShotReferenceCard
          title={selectedSheet.title}
          description={group.name}
          imageUrl={sheetImageUrl}
          imageAlt={sheetPreview?.alt ?? selectedSheet.title}
          card={selectedSheet.card}
          selected={group.selectedForShot}
          aspectRatio={4 / 3}
          aspectClassName='aspect-[4/3]'
          onOpen={() => {
            if (sheetPreviewImages.length) {
              onPreview(sheetPreviewImages);
            }
          }}
          onToggleSelected={() =>
            group.selectedForShot
              ? onSelectLocation(group.locationId)
              : onSelectLocation(group.locationId)
          }
        />
        <CollapsibleTrigger asChild>
          <Button
            type='button'
            variant='ghost'
            className='h-full rounded-md border border-border/50 bg-muted/30 px-0'
            aria-label={open ? 'Hide location views' : 'Show location views'}
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform',
                open ? 'rotate-90' : null
              )}
            />
          </Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className='pt-3'>
        <SceneShotReferenceCardRow>
          {group.environmentSheets.map((sheet) => {
            const preview = sheet.card.previews[0];
            const imageUrl =
              preview && sheet.assetId
                ? locationAssetFileUrl(
                    projectName,
                    group.locationId,
                    preview.assetId,
                    preview.assetFileId
                  )
                : null;
            const previewImages = previewImageUrl(preview, imageUrl);
            return (
              <div key={sheet.id} className='w-[220px] shrink-0'>
                <SceneShotReferenceCard
                  title={sheet.title}
                  description={group.name}
                  imageUrl={imageUrl}
                  imageAlt={preview?.alt ?? sheet.title}
                  card={sheet.card}
                  selected={sheet.selected}
                  aspectRatio={4 / 3}
                  aspectClassName='aspect-[4/3]'
                  onOpen={() => {
                    if (previewImages.length) {
                      onPreview(previewImages);
                    }
                  }}
                  onToggleSelected={() =>
                    onSelectSheet(group.locationId, sheet.assetId)
                  }
                />
              </div>
            );
          })}
          {selectedSheet.views.map((view) => {
            const preview = view.card.previews[0];
            const imageUrl =
              preview && selectedSheet.assetId
                ? locationAssetFileUrl(
                    projectName,
                    group.locationId,
                    preview.assetId,
                    preview.assetFileId
                  )
                : null;
            const previewImages = previewImageUrl(preview, imageUrl);
            return (
              <div key={view.id} className='w-[180px] shrink-0'>
                <SceneShotReferenceCard
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
                    selectedSheet.assetId
                      ? onToggleView(
                          group.locationId,
                          selectedSheet.assetId,
                          view.viewId,
                          view.selected
                        )
                      : Promise.resolve()
                  }
                />
              </div>
            );
          })}
        </SceneShotReferenceCardRow>
      </CollapsibleContent>
    </Collapsible>
  );
}
