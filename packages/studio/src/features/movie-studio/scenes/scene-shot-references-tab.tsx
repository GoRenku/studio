import { useEffect, useState } from 'react';
import type {
  SceneShotVideoTake,
  ShotVideoTakeGeneralReferenceChoice,
  ShotVideoTakeReferenceImagePreview,
} from '@gorenku/studio-core/client';
import type { ShotVideoTakeWorkspaceResponse } from '@/services/studio-shot-video-takes-api';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { idleSaveNotification } from '../detail-save-notification';
import { SceneShotCastReferenceCard } from './scene-shot-cast-reference-card';
import { previewImageUrl } from './scene-shot-reference-card-images';
import { SceneShotLocationReferenceRow } from './scene-shot-location-reference-row';
import { SceneShotReferenceCard } from './scene-shot-reference-card';
import { SceneShotReferenceCardGrid } from './scene-shot-reference-card-grid';
import {
  SHOT_REFERENCE_CAST_CARD_MIN_WIDTH,
  SHOT_REFERENCE_LOCATION_CARD_MIN_WIDTH,
} from './scene-shot-reference-layout';
import { SceneShotReferenceSection } from './scene-shot-reference-section';
import { useTakeEditorMutationStatus } from './use-take-editor-mutation-status';
import { useImageRevisionDialog } from '@/features/image-revision/use-image-revision-dialog';

interface SceneShotReferencesTabProps {
  projectName: string;
  sceneId: string;
  take: SceneShotVideoTake | null;
  references: ShotVideoTakeWorkspaceResponse['generation']['references'] | null;
  diagnostics?: Array<{ code: string; message: string }>;
  onSetReference: (selectionId: string, included: boolean) => Promise<void>;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
}

export function SceneShotReferencesTab({
  projectName,
  sceneId,
  take,
  references,
  diagnostics = [],
  onSetReference,
  onSaveNotificationChange,
}: SceneShotReferencesTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const mutationStatus = useTakeEditorMutationStatus({
    failureMessage: 'References could not be saved.',
  });
  const referenceIssues =
    diagnostics.filter(isReferenceDiagnosticIssue);
  useEffect(() => {
    onSaveNotificationChange?.(mutationStatus.status);
    return () => onSaveNotificationChange?.(idleSaveNotification);
  }, [mutationStatus.status, onSaveNotificationChange]);

  const updateReferenceInclusion = async (
    selectionId: string,
    included: boolean
  ) => {
    if (!take) {
      return;
    }
    await mutationStatus.runTakeEditorMutation(async () => {
      await onSetReference(selectionId, included);
    });
  };

  return (
    <>
      <div className='flex flex-col gap-6 py-4'>
        <SceneShotReferenceSection title='General' defaultOpen>
          {references?.general.length ? (
            <SceneShotReferenceCardGrid>
              {references.general.map((choice) => (
                <GeneralReferenceCard
                  key={choice.id}
                  projectName={projectName}
                  sceneId={sceneId}
                  takeId={take?.takeId ?? ''}
                  choice={choice}
                  onPreview={(images) => setPreviewImage(images[0] ?? null)}
                  onToggleInclusion={async (selectionId, included) => {
                    await updateReferenceInclusion(selectionId, included);
                  }}
                />
              ))}
            </SceneShotReferenceCardGrid>
          ) : (
            <p className='text-sm text-muted-foreground'>No general references.</p>
          )}
        </SceneShotReferenceSection>

        <SceneShotReferenceSection
          title='Lookbook'
          defaultOpen={Boolean(references?.lookbook.length)}
        >
          {references?.lookbook.length ? (
            <SceneShotReferenceCardGrid>
              {references.lookbook.map((choice) => {
                const preview = choice.card.previews[0];
                const imageUrl = preview && 'url' in preview ? preview.url : null;
                const previewImages = previewImageUrl(preview, imageUrl);
                return (
                  <SceneShotReferenceCard
                    key={choice.id}
                    title={choice.title}
                    imageUrl={imageUrl}
                    imageAlt={preview?.alt ?? choice.title}
                    card={choice.card}
                    selected={choice.card.included}
                    controlMode='inclusion'
                    detectImageAspectRatio
                    onOpen={() => setPreviewImage(previewImages[0] ?? null)}
                    onToggleSelected={async () => {
                      await updateReferenceInclusion(
                        choice.card.selectionId,
                        !choice.card.included
                      );
                    }}
                  />
                );
              })}
            </SceneShotReferenceCardGrid>
          ) : (
            <p className='text-sm text-muted-foreground'>No Lookbook selected.</p>
          )}
        </SceneShotReferenceSection>

        <SceneShotReferenceSection
          title='Cast Character Sheets'
          defaultOpen={Boolean(references?.castMembers.length)}
        >
          {references?.castMembers.length ? (
            <SceneShotReferenceCardGrid
              minCardWidth={SHOT_REFERENCE_CAST_CARD_MIN_WIDTH}
            >
              {references.castMembers.map((group) => (
                <SceneShotCastReferenceCard
                  key={group.castMemberId}
                  projectName={projectName}
                  group={group}
                  onPreview={(images) => setPreviewImage(images[0] ?? null)}
                  onToggleInclusion={async (selectionId, included) => {
                    await updateReferenceInclusion(selectionId, included);
                  }}
                  onSelectSheet={async (castMemberId, assetId) => {
                    const choice = group.characterSheets.find(
                      (candidate) => candidate.castMemberId === castMemberId && candidate.assetId === assetId
                    );
                    if (!choice) return;
                    await mutationStatus.runTakeEditorMutation(async () => {
                      await onSetReference(choice.card.selectionId, true);
                    });
                  }}
                />
              ))}
            </SceneShotReferenceCardGrid>
          ) : (
            <p className='text-sm text-muted-foreground'>No scene cast available.</p>
          )}
        </SceneShotReferenceSection>

        <SceneShotReferenceSection
          title='Location Sheets'
          defaultOpen={Boolean(references?.locations.length)}
        >
          {references?.locations.length ? (
            <SceneShotReferenceCardGrid
              minCardWidth={SHOT_REFERENCE_LOCATION_CARD_MIN_WIDTH}
            >
              {references.locations.map((group) => (
                <SceneShotLocationReferenceRow
                  key={group.locationId}
                  projectName={projectName}
                  group={group}
                  onPreview={(images) => setPreviewImage(images[0] ?? null)}
                  onToggleSheet={async (locationId, assetId, selected) => {
                    const choice = group.environmentSheets.find(
                      (candidate) => candidate.locationId === locationId && candidate.assetId === assetId
                    );
                    if (!choice) return;
                    await mutationStatus.runTakeEditorMutation(async () => {
                      await onSetReference(choice.card.selectionId, !selected);
                    });
                  }}
                />
              ))}
            </SceneShotReferenceCardGrid>
          ) : (
            <p className='text-sm text-muted-foreground'>No scene location available.</p>
          )}
        </SceneShotReferenceSection>

        {referenceIssues.length ? (
          <SceneShotReferenceSection title='Reference Issues' defaultOpen>
            <Alert>
              <AlertTitle>Reference issues</AlertTitle>
              <AlertDescription>
                {referenceIssues.map((issue) => (
                  <p key={`${issue.code}:${issue.message}`}>{issue.message}</p>
                ))}
              </AlertDescription>
            </Alert>
          </SceneShotReferenceSection>
        ) : null}
      </div>
      <ImagePreviewDialog
        images={previewImage ? [previewImage] : []}
        currentIndex={0}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />
    </>
  );
}

function isReferenceDiagnosticIssue(issue: { code: string }): boolean {
  return (
    issue.code.startsWith('CORE_GENERATION_SHOT_') ||
    issue.code.startsWith('CORE_SHOT_REFERENCE_') ||
    issue.code.startsWith('CORE_MEDIA_DEPENDENCY_')
  );
}

function GeneralReferenceCard({
  projectName,
  sceneId,
  takeId,
  choice,
  onPreview,
  onToggleInclusion,
}: {
  projectName: string;
  sceneId: string;
  takeId: string;
  choice: ShotVideoTakeGeneralReferenceChoice;
  onPreview: (images: PreviewImage[]) => void;
  onToggleInclusion: (
    selectionId: string,
    included: boolean
  ) => Promise<void>;
}) {
  const { openImageRevision } = useImageRevisionDialog();
  const preview = choice.card.previews[0];
  const imageUrl = preview ? generalReferenceImageUrl(projectName, preview) : null;
  const previewImages = previewImageUrl(preview, imageUrl);

  return (
    <SceneShotReferenceCard
      title={choice.title}
      imageUrl={imageUrl}
      imageAlt={preview?.alt ?? choice.title}
      card={choice.card}
      selected={choice.card.included}
      controlMode='inclusion'
      aspectRatio={16 / 9}
      aspectClassName='aspect-video'
      detectImageAspectRatio
      onOpen={() => onPreview(previewImages)}
      onEditImage={
        preview
          ? () =>
              openImageRevision({
                projectName,
                target: {
                  kind: 'shotVideoTakeReference',
                  sceneId,
                  takeId,
                  selectionId: preview.selectionId,
                  assetId: preview.assetId,
                  assetFileId: preview.assetFileId,
                },
              })
          : undefined
      }
      onToggleSelected={() => {
        return onToggleInclusion(
          choice.card.selectionId,
          !choice.card.included
        );
      }}
    />
  );
}

function generalReferenceImageUrl(
  projectName: string,
  preview: ShotVideoTakeReferenceImagePreview
): string {
  if ('url' in preview && typeof preview.url === 'string') {
    return preview.url;
  }
  return `/studio-api/projects/${encodeURIComponent(projectName)}/assets/${encodeURIComponent(preview.assetId)}/files/${encodeURIComponent(preview.assetFileId)}`;
}
