import { useState } from 'react';
import type {
  ShotVideoTakeCastMemberReferenceGroup,
  ShotVideoTakeCharacterSheetReferenceChoice,
} from '@gorenku/studio-core/client';
import { castAssetFileUrl } from '@/services/studio-project-assets-api';
import type { PreviewImage } from '@/ui/image-preview-dialog';
import { previewImageUrl } from './scene-shot-reference-card-images';
import { SceneShotReferenceCard } from './scene-shot-reference-card';
import { ReferencePickerDialog } from '@/features/reference-picker/reference-picker-dialog';

interface SceneShotCastReferenceCardProps {
  projectName: string;
  group: ShotVideoTakeCastMemberReferenceGroup;
  onPreview: (images: PreviewImage[]) => void;
  onToggleInclusion: (
    selectionId: string,
    included: boolean
  ) => Promise<void>;
  onSelectSheet: (castMemberId: string, assetId: string | null) => Promise<void>;
}

export function SceneShotCastReferenceCard({
  projectName,
  group,
  onPreview,
  onToggleInclusion,
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
        selected={selectedSheet.card.included}
        controlMode='inclusion'
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
          onToggleInclusion(
            selectedSheet.card.selectionId,
            !selectedSheet.card.included
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
  void onPreview;
  return (
    <ReferencePickerDialog
      open={open}
      onOpenChange={onOpenChange}
      title={group.name}
      description='Choose the exact Character Sheet for this saved Take request.'
      candidates={group.characterSheets.map((choice) => {
        const preview = choice.card.previews[0];
        return {
          id: choice.assetId ?? choice.id,
          title: choice.title,
          imageUrl: castReferenceImageUrl(projectName, group.castMemberId, choice, preview),
          imageAlt: choice.title,
          selected: choice.selected,
        };
      })}
      onChoose={(assetId) => onSelectSheet(assetId)}
    />
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
