import { useEffect, useState } from 'react';
import type {
  ShotVideoTakeGeneralReferenceChoice,
  ShotVideoTakeProductionPlanReport,
  ShotVideoTakeReferenceImagePreview,
} from '@gorenku/studio-core/client';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import {
  sceneAssetFileUrl,
  shotVideoTakeInputFileUrl,
} from '@/services/studio-project-assets-api';
import {
  updateShotGroupReferenceInclusion,
  updateTakeCharacterSheetSelection,
  updateTakeLocationSheetSelection,
  type ShotVideoTakeProductionMutation,
} from '@/services/studio-shot-video-takes-api';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { idleSaveNotification } from '../detail-save-notification';
import { lookbookSheetFileUrl } from '../visual-language/visual-language-image-urls';
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

interface SceneShotReferencesTabProps {
  projectName: string;
  sceneId: string;
  selectedShotId?: string;
  productionPlan: ShotVideoTakeProductionPlanReport | null;
  onPlanRefresh?: () => Promise<void>;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
}

export function SceneShotReferencesTab({
  projectName,
  sceneId,
  selectedShotId,
  productionPlan,
  onPlanRefresh,
  onSaveNotificationChange,
}: SceneShotReferencesTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const mutationStatus = useTakeEditorMutationStatus({
    failureMessage: 'References could not be saved.',
  });
  const references = productionPlan?.references;
  const scopedShotId = selectedShotId ?? productionPlan?.take?.shotIds[0];
  const mutationShotId =
    productionPlan?.take?.state?.structure.mode === 'multi-cut'
      ? scopedShotId
      : undefined;
  const referenceIssues =
    productionPlan?.diagnostics.filter(isReferenceDiagnosticIssue) ?? [];

  const refreshAfterMutation = async (_result: ShotVideoTakeProductionMutation) => {
    await onPlanRefresh?.();
  };
  useEffect(() => {
    onSaveNotificationChange?.(mutationStatus.status);
    return () => onSaveNotificationChange?.(idleSaveNotification);
  }, [mutationStatus.status, onSaveNotificationChange]);

  const updateReferenceInclusion = async (
    dependencyId: string,
    inclusion: 'include' | 'exclude' | null
  ) => {
    const take = productionPlan?.take;
    if (!take) {
      return;
    }
    await mutationStatus.runTakeEditorMutation(async () => {
      const result = await updateShotGroupReferenceInclusion(
        projectName,
        sceneId,
        take.takeId,
        {
          dependencyId,
          inclusion,
          ...(mutationShotId ? { shotId: mutationShotId } : {}),
        }
      );
      await refreshAfterMutation(result);
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
                  choice={choice}
                  onPreview={(images) => setPreviewImage(images[0] ?? null)}
                  onToggleInclusion={async (dependencyId, inclusion) => {
                    await updateReferenceInclusion(dependencyId, inclusion);
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
                const imageUrl =
                  preview && choice.lookbookSheetId
                    ? lookbookSheetFileUrl(
                        projectName,
                        choice.lookbookSheetId,
                        preview.assetFileId
                      )
                    : null;
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
                      if (!choice.card.dependencyId) {
                        return;
                      }
                      await updateReferenceInclusion(
                        choice.card.dependencyId,
                        nextReferenceInclusion(choice.card)
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
                  onToggleInclusion={async (dependencyId, inclusion) => {
                    await updateReferenceInclusion(dependencyId, inclusion);
                  }}
                  onSelectSheet={async (castMemberId, assetId) => {
                    const take = productionPlan?.take;
                    if (!take) {
                      return;
                    }
                    await mutationStatus.runTakeEditorMutation(async () => {
                      const sheetResult =
                        await updateTakeCharacterSheetSelection(
                          projectName,
                          sceneId,
                          take.takeId,
                          {
                            ...(mutationShotId ? { shotId: mutationShotId } : {}),
                            castMemberId,
                            assetId,
                          }
                        );
                      await refreshAfterMutation(sheetResult);
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
                    const take = productionPlan?.take;
                    if (!take) {
                      return;
                    }
                    await mutationStatus.runTakeEditorMutation(async () => {
                      const result = await updateTakeLocationSheetSelection(
                        projectName,
                        sceneId,
                        take.takeId,
                        {
                          ...(mutationShotId ? { shotId: mutationShotId } : {}),
                          locationId,
                          assetId: selected ? null : assetId,
                        }
                      );
                      await refreshAfterMutation(result);
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
    issue.code.startsWith('CORE_SHOT_REFERENCE_') ||
    issue.code.startsWith('CORE_SHOT_VIDEO_DEPENDENCY_') ||
    issue.code.startsWith('CORE_SHOT_VIDEO_PLAN_REQUIRED_ATTACHMENT_') ||
    issue.code.startsWith('CORE_MEDIA_DEPENDENCY_')
  );
}

function GeneralReferenceCard({
  projectName,
  sceneId,
  choice,
  onPreview,
  onToggleInclusion,
}: {
  projectName: string;
  sceneId: string;
  choice: ShotVideoTakeGeneralReferenceChoice;
  onPreview: (images: PreviewImage[]) => void;
  onToggleInclusion: (
    dependencyId: string,
    inclusion: 'include' | 'exclude' | null
  ) => Promise<void>;
}) {
  const preview = choice.card.previews[0];
  const imageUrl = preview ? generalReferenceImageUrl(projectName, sceneId, preview) : null;
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
      onToggleSelected={() => {
        if (choice.card.dependencyId) {
          return onToggleInclusion(
            choice.card.dependencyId,
            nextReferenceInclusion(choice.card)
          );
        }
        return Promise.resolve();
      }}
    />
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

function generalReferenceImageUrl(
  projectName: string,
  sceneId: string,
  preview: ShotVideoTakeReferenceImagePreview
): string {
  if (preview.inputId && preview.takeId) {
    return shotVideoTakeInputFileUrl(
      projectName,
      sceneId,
      preview.takeId,
      preview.inputId,
      preview.assetFileId
    );
  }
  if (preview.url) {
    return preview.url;
  }
  return sceneAssetFileUrl(projectName, sceneId, preview.assetId, preview.assetFileId);
}
