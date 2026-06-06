import { useState } from 'react';
import type {
  ShotVideoTakeInputKind,
  ShotVideoTakeInputSubjectKind,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import {
  sceneAssetFileUrl,
  shotVideoTakeInputFileUrl,
} from '@/services/studio-project-assets-api';
import type { ShotVideoTakeInputSlot } from '@/services/studio-shot-video-takes-api';
import { ImageCollectionSection } from '@/ui/image-collection-section';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { ImageSelectionControl } from '@/ui/image-selection-control';
import { previewImageUrl } from './scene-shot-reference-card-images';

interface SceneShotReferencesTabProps {
  projectName: string;
  sceneId: string;
  productionPlan: ShotVideoTakeProductionPlanReport | null;
  onSelectInput: (inputId: string) => Promise<void>;
  onClearInput: (slot: ShotVideoTakeInputSlot) => Promise<void>;
  onDeleteInput: (inputId: string) => Promise<void>;
}

export function SceneShotReferencesTab({
  projectName,
  sceneId,
  productionPlan,
  onSelectInput,
  onClearInput,
  onDeleteInput,
}: SceneShotReferencesTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const items =
    productionPlan?.imageReferences.map((choice) => {
      const preview = choice.image.previews[0];
      const imageUrl = preview
        ? preview.inputId
          ? shotVideoTakeInputFileUrl(
              projectName,
              sceneId,
              preview.inputId,
              preview.assetFileId
            )
          : sceneAssetFileUrl(projectName, sceneId, preview.assetId, preview.assetFileId)
        : null;
      const previewImages = previewImageUrl(preview, imageUrl);
      const inputSlot = inputSlotForDependencyId(choice.image.dependencyId);
      return {
        id: `${choice.referenceKind}:${
          preview?.inputId ?? choice.image.dependencyId ?? choice.title
        }`,
        imageUrl,
        imageAlt: preview?.alt ?? choice.title,
        aspectClassName: 'aspect-video',
        aspectRatio: 16 / 9,
        detectImageAspectRatio: true,
        selected: choice.selected,
        onOpen: () => {
          if (previewImages[0]) {
            setPreviewImage(previewImages[0]);
          }
        },
        bottomRightControl: (
          <ImageSelectionControl
            selected={choice.selected}
            selectedLabel={`Clear ${choice.title} pick`}
            unselectedLabel={`Set ${choice.title} pick`}
            onToggleSelected={() => {
              if (!choice.selected && preview?.inputId) {
                return onSelectInput(preview.inputId);
              }
              if (choice.selected && inputSlot) {
                return onClearInput(inputSlot);
              }
              return Promise.resolve();
            }}
          />
        ),
        deleteAction: preview?.inputId
          ? {
              label: 'Delete reference image',
              title: 'Delete Reference Image?',
              message:
                'Remove this reference image from this video take setup. This cannot be undone.',
              onDelete: async () => {
                await onDeleteInput(preview.inputId as string);
                setPreviewImage(null);
              },
            }
          : undefined,
      };
    }) ?? [];

  return (
    <>
      <div className='space-y-6 py-4'>
        <ImageCollectionSection
          title='Reference Images'
          emptyTitle='No reference images yet.'
          items={items}
          gridClassName='grid-cols-[repeat(auto-fill,minmax(220px,1fr))]'
        />
      </div>
      <ImagePreviewDialog
        images={previewImage ? [previewImage] : []}
        currentIndex={0}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />
    </>
  );
}

function inputSlotForDependencyId(
  dependencyId: string | undefined
): ShotVideoTakeInputSlot | null {
  if (!dependencyId) {
    return null;
  }
  const [kind, subjectKind, subjectId] = dependencyId.split(':');
  if (!isShotVideoTakeInputKind(kind)) {
    return null;
  }
  return {
    kind,
    ...(isShotVideoTakeInputSubjectKind(subjectKind) ? { subjectKind } : {}),
    ...(subjectId ? { subjectId } : {}),
  };
}

function isShotVideoTakeInputKind(
  value: string | undefined
): value is ShotVideoTakeInputKind {
  return (
    value === 'first-frame' ||
    value === 'last-frame' ||
    value === 'reference-image' ||
    value === 'multi-shot-storyboard-sheet'
  );
}

function isShotVideoTakeInputSubjectKind(
  value: string | undefined
): value is ShotVideoTakeInputSubjectKind {
  return (
    value === 'cast-member' ||
    value === 'location' ||
    value === 'lookbook' ||
    value === 'shot' ||
    value === 'production-group'
  );
}
