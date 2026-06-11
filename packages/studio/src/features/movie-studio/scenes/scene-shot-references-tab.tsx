import { useState } from 'react';
import type {
  LocationAzimuthViewId,
  SceneShot,
  ShotVideoTakeGeneralReferenceChoice,
  ShotVideoTakeProductionPlanReport,
  ShotVideoTakeReferenceImagePreview,
} from '@gorenku/studio-core/client';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import {
  sceneAssetFileUrl,
  shotVideoTakeInputFileUrl,
} from '@/services/studio-project-assets-api';
import type { ShotVideoTakeInputSlot } from '@/services/studio-shot-video-takes-api';
import {
  updateShotCastCharacterSheetReference,
  updateShotCastReferences,
  updateShotLocationReference,
  updateShotLocationViewReferences,
  updateShotLookbookReference,
} from '@/services/studio-shot-video-takes-api';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
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

interface SceneShotReferencesTabProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  productionPlan: ShotVideoTakeProductionPlanReport | null;
  onSelectInput: (inputId: string) => Promise<void>;
  onClearInput: (slot: ShotVideoTakeInputSlot) => Promise<void>;
  onResourceRefreshed?: (resource: SceneShotListResourceResponse) => void;
  onPlanRefresh?: () => Promise<void>;
}

export function SceneShotReferencesTab({
  projectName,
  sceneId,
  shot,
  productionPlan,
  onSelectInput,
  onClearInput,
  onResourceRefreshed,
  onPlanRefresh,
}: SceneShotReferencesTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const references = productionPlan?.references;
  const referenceIssues =
    productionPlan?.diagnostics.filter(isReferenceDiagnosticIssue) ?? [];

  const refreshAfterMutation = async (result: {
    resource: SceneShotListResourceResponse;
  }) => {
    onResourceRefreshed?.(result.resource);
    await onPlanRefresh?.();
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
                  onSelectInput={onSelectInput}
                  onClearInput={onClearInput}
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
                    selected={choice.selected}
                    detectImageAspectRatio
                    onOpen={() => setPreviewImage(previewImages[0] ?? null)}
                    onToggleSelected={async () => {
                      const result = await updateShotLookbookReference(
                        projectName,
                        sceneId,
                        shot.shotId,
                        choice.lookbookSheetId
                      );
                      await refreshAfterMutation(result);
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
              {references.castMembers.map((group) => {
                const selectedIds =
                  shot.shotSpecs?.castReferences?.castMemberIds ?? shot.castMemberIds;
                const selectedIdSet = new Set(selectedIds);
                return (
                  <SceneShotCastReferenceCard
                    key={group.castMemberId}
                    projectName={projectName}
                    group={group}
                    onPreview={(images) => setPreviewImage(images[0] ?? null)}
                    onSelectCast={async (castMemberId) => {
                      if (selectedIdSet.has(castMemberId)) {
                        return;
                      }
                      const castResult = await updateShotCastReferences(
                        projectName,
                        sceneId,
                        shot.shotId,
                        [...selectedIds, castMemberId]
                      );
                      onResourceRefreshed?.(castResult.resource);
                    }}
                    onSelectSheet={async (castMemberId, assetId) => {
                      const sheetResult =
                        await updateShotCastCharacterSheetReference(
                          projectName,
                          sceneId,
                          shot.shotId,
                          {
                            castMemberId,
                            assetId,
                          }
                        );
                      await refreshAfterMutation(sheetResult);
                    }}
                  />
                );
              })}
            </SceneShotReferenceCardGrid>
          ) : (
            <p className='text-sm text-muted-foreground'>No scene cast available.</p>
          )}
        </SceneShotReferenceSection>

        <SceneShotReferenceSection
          title='Location Sheets And Views'
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
                  onSelectLocation={async (locationId) => {
                    const result = await updateShotLocationReference(
                      projectName,
                      sceneId,
                      shot.shotId,
                      locationId
                    );
                    await refreshAfterMutation(result);
                  }}
                  onToggleView={async (locationId, assetId, viewId, selected) => {
                    const nextViewIds = nextLocationViewIds(
                      group.selectedViewIds,
                      viewId,
                      selected
                    );
                    const result = await updateShotLocationViewReferences(
                      projectName,
                      sceneId,
                      shot.shotId,
                      { locationId, assetId, viewIds: nextViewIds }
                    );
                    await refreshAfterMutation(result);
                  }}
                />
              ))}
            </SceneShotReferenceCardGrid>
          ) : (
            <p className='text-sm text-muted-foreground'>No scene location available.</p>
          )}
        </SceneShotReferenceSection>

        {referenceIssues.length ? (
          <SceneShotReferenceSection title='Reference Issues'>
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
    issue.code.startsWith('CORE_SHOT_VIDEO_PLAN_REQUIRED_ATTACHMENT_')
  );
}

function GeneralReferenceCard({
  projectName,
  sceneId,
  choice,
  onPreview,
  onSelectInput,
  onClearInput,
}: {
  projectName: string;
  sceneId: string;
  choice: ShotVideoTakeGeneralReferenceChoice;
  onPreview: (images: PreviewImage[]) => void;
  onSelectInput: (inputId: string) => Promise<void>;
  onClearInput: (slot: ShotVideoTakeInputSlot) => Promise<void>;
}) {
  const preview = choice.card.previews[0];
  const imageUrl = preview ? generalReferenceImageUrl(projectName, sceneId, preview) : null;
  const previewImages = previewImageUrl(preview, imageUrl);
  const inputSlot = inputSlotForDependencyId(choice.card.dependencyId);

  return (
    <SceneShotReferenceCard
      title={choice.title}
      imageUrl={imageUrl}
      imageAlt={preview?.alt ?? choice.title}
      card={choice.card}
      selected={choice.selected}
      aspectRatio={16 / 9}
      aspectClassName='aspect-video'
      detectImageAspectRatio
      onOpen={() => onPreview(previewImages)}
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
  );
}

function generalReferenceImageUrl(
  projectName: string,
  sceneId: string,
  preview: ShotVideoTakeReferenceImagePreview
): string {
  if (preview.inputId) {
    return shotVideoTakeInputFileUrl(
      projectName,
      sceneId,
      preview.inputId,
      preview.assetFileId
    );
  }
  return sceneAssetFileUrl(projectName, sceneId, preview.assetId, preview.assetFileId);
}

function nextLocationViewIds(
  selectedViewIds: LocationAzimuthViewId[],
  viewId: LocationAzimuthViewId,
  selected: boolean
): LocationAzimuthViewId[] {
  if (selected) {
    return selectedViewIds.filter((candidate) => candidate !== viewId);
  }
  return [...new Set([...selectedViewIds, viewId])];
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
): value is ShotVideoTakeInputSlot['kind'] {
  return (
    value === 'first-frame' ||
    value === 'last-frame' ||
    value === 'reference-image' ||
    value === 'multi-shot-storyboard-sheet'
  );
}

function isShotVideoTakeInputSubjectKind(
  value: string | undefined
): value is NonNullable<ShotVideoTakeInputSlot['subjectKind']> {
  return (
    value === 'cast-member' ||
    value === 'location' ||
    value === 'lookbook' ||
    value === 'shot' ||
    value === 'production-group'
  );
}
