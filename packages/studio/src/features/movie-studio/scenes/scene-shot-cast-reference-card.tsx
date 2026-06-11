import { useState } from 'react';
import type {
  ShotVideoTakeCastMemberReferenceGroup,
  ShotVideoTakeCharacterSheetReferenceChoice,
} from '@gorenku/studio-core/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { castAssetFileUrl } from '@/services/studio-project-assets-api';
import type { PreviewImage } from '@/ui/image-preview-dialog';
import { previewImageUrl } from './scene-shot-reference-card-images';
import { SceneShotReferenceCard } from './scene-shot-reference-card';
import { SceneShotReferenceCardGrid } from './scene-shot-reference-card-grid';
import {
  SHOT_CAST_SHEET_DIALOG_CARD_MIN_WIDTH,
  SHOT_CAST_SHEET_DIALOG_CLASS,
} from './scene-shot-reference-layout';

interface SceneShotCastReferenceCardProps {
  projectName: string;
  group: ShotVideoTakeCastMemberReferenceGroup;
  onPreview: (images: PreviewImage[]) => void;
  onSelectCast: (castMemberId: string) => Promise<void>;
  onSelectSheet: (castMemberId: string, assetId: string | null) => Promise<void>;
}

export function SceneShotCastReferenceCard({
  projectName,
  group,
  onPreview,
  onSelectCast,
  onSelectSheet,
}: SceneShotCastReferenceCardProps) {
  const [sheetDialogOpen, setSheetDialogOpen] = useState(false);
  const selectedSheet =
    group.characterSheets.find((sheet) => sheet.selected) ??
    group.characterSheets[0] ??
    null;

  if (!selectedSheet) {
    return null;
  }

  const preview = selectedSheet.card.previews[0];
  const imageUrl = castReferenceImageUrl(
    projectName,
    group.castMemberId,
    selectedSheet,
    preview
  );
  const previewImages = previewImageUrl(preview, imageUrl);
  const hasSheetAlternatives = group.characterSheets.length > 1;

  return (
    <>
      <SceneShotReferenceCard
        title={group.name}
        description={group.role ?? undefined}
        imageUrl={imageUrl}
        imageAlt={group.name}
        card={selectedSheet.card}
        selected={group.selectedForShot && selectedSheet.selected}
        aspectRatio={4 / 3}
        aspectClassName='aspect-[4/3]'
        onOpen={() => {
          if (hasSheetAlternatives) {
            setSheetDialogOpen(true);
            return;
          }
          onPreview(previewImages);
        }}
        onToggleSelected={() =>
          group.selectedForShot
            ? onSelectSheet(group.castMemberId, selectedSheet.assetId)
            : onSelectCast(group.castMemberId).then(() =>
                onSelectSheet(group.castMemberId, selectedSheet.assetId)
              )
        }
      />
      {hasSheetAlternatives ? (
        <CastSheetDialog
          projectName={projectName}
          group={group}
          open={sheetDialogOpen}
          onOpenChange={setSheetDialogOpen}
          onPreview={onPreview}
          onSelectSheet={async (assetId) => {
            if (!group.selectedForShot) {
              await onSelectCast(group.castMemberId);
            }
            await onSelectSheet(group.castMemberId, assetId);
          }}
        />
      ) : null}
    </>
  );
}

function CastSheetDialog({
  projectName,
  group,
  open,
  onOpenChange,
  onPreview,
  onSelectSheet,
}: {
  projectName: string;
  group: ShotVideoTakeCastMemberReferenceGroup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreview: (images: PreviewImage[]) => void;
  onSelectSheet: (assetId: string | null) => Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHOT_CAST_SHEET_DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle className='truncate text-base normal-case leading-6 tracking-normal'>
            {group.name}
          </DialogTitle>
          <DialogDescription className='sr-only'>
            Select a character sheet for this cast member.
          </DialogDescription>
        </DialogHeader>
        <div className='max-h-[60vh] overflow-y-auto px-5 py-5'>
          <SceneShotReferenceCardGrid
            minCardWidth={SHOT_CAST_SHEET_DIALOG_CARD_MIN_WIDTH}
          >
            {group.characterSheets.map((choice, index) => {
              const preview = choice.card.previews[0];
              const imageUrl = castReferenceImageUrl(
                projectName,
                group.castMemberId,
                choice,
                preview
              );
              const previewImages = previewImageUrl(preview, imageUrl);
              const sheetLabel =
                group.characterSheets.length > 1 ? `Sheet ${index + 1}` : group.name;
              return (
                <SceneShotReferenceCard
                  key={choice.id}
                  title={sheetLabel}
                  imageUrl={imageUrl}
                  imageAlt={sheetLabel}
                  card={choice.card}
                  selected={choice.selected}
                  aspectRatio={4 / 3}
                  aspectClassName='aspect-[4/3]'
                  onOpen={() => {
                    if (previewImages.length) {
                      onPreview(previewImages);
                    }
                  }}
                  onToggleSelected={() => onSelectSheet(choice.assetId)}
                />
              );
            })}
          </SceneShotReferenceCardGrid>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function castReferenceImageUrl(
  projectName: string,
  castMemberId: string,
  choice: ShotVideoTakeCharacterSheetReferenceChoice,
  preview: ShotVideoTakeCharacterSheetReferenceChoice['card']['previews'][number] | undefined
): string | null {
  if (!preview || !choice.assetId) {
    return null;
  }
  return castAssetFileUrl(
    projectName,
    castMemberId,
    preview.assetId,
    preview.assetFileId
  );
}
