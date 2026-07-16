import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type {
  GenerationReference,
  SceneShotVideoTake,
  GenerationReferenceSlotSelectionInput,
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
import { GenericReferencePickerDialog } from '@/features/reference-picker/reference-picker-dialog';
import { Button } from '@/ui/button';
import { ImageOverlayCard } from '@/ui/image-overlay-card';

interface SceneShotReferencesTabProps {
  projectName: string;
  sceneId: string;
  take: SceneShotVideoTake | null;
  references: ShotVideoTakeWorkspaceResponse['generation']['references'] | null;
  diagnostics?: Array<{ code: string; message: string }>;
  onSetReference: (selection: GenerationReferenceSlotSelectionInput) => Promise<void>;
  onSetGenericReferences: (references: GenerationReference[]) => Promise<void>;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
}

export function SceneShotReferencesTab({
  projectName,
  sceneId,
  take,
  references,
  diagnostics = [],
  onSetReference,
  onSetGenericReferences,
  onSaveNotificationChange,
}: SceneShotReferencesTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [genericPickerOpen, setGenericPickerOpen] = useState(false);
  const mutationStatus = useTakeEditorMutationStatus({
    failureMessage: 'References could not be saved.',
  });
  const referenceIssues =
    diagnostics.filter(isReferenceDiagnosticIssue);
  useEffect(() => {
    onSaveNotificationChange?.(mutationStatus.status);
    return () => onSaveNotificationChange?.(idleSaveNotification);
  }, [mutationStatus.status, onSaveNotificationChange]);

  if (references?.kind === 'completed') {
    return <CompletedTakeReferences references={references.usedReferences} />;
  }

  const updateReferenceInclusion = async (
    selectionId: string,
    included: boolean
  ) => {
    if (!take) {
      return;
    }
    const card = findReferenceCard(references, selectionId);
    if (!card?.selection) {
      return;
    }
    const selection = included
      ? card.selection
      : { ...card.selection, reference: null };
    await mutationStatus.runTakeEditorMutation(async () => {
      await onSetReference(selection);
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
                    if (assetId === null) {
                      const current = group.characterSheets.find(
                        (candidate) => candidate.selected
                      );
                      if (current) {
                        await updateReferenceInclusion(current.card.selectionId, false);
                      }
                      return;
                    }
                    const choice = group.characterSheets.find(
                      (candidate) => candidate.castMemberId === castMemberId && candidate.assetId === assetId
                    );
                    if (!choice) return;
                    await updateReferenceInclusion(choice.card.selectionId, true);
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
                    await updateReferenceInclusion(choice.card.selectionId, !selected);
                  }}
                />
              ))}
            </SceneShotReferenceCardGrid>
          ) : (
            <p className='text-sm text-muted-foreground'>No scene location available.</p>
          )}
        </SceneShotReferenceSection>

        <SceneShotReferenceSection title='Additional Media' defaultOpen>
          <div className='mb-3'>
            <Button
              type='button'
              variant='outline'
              disabled={!take}
              onClick={() => setGenericPickerOpen(true)}
            >
              Add Media
            </Button>
          </div>
          {references?.genericReferences.length ? (
            <SceneShotReferenceCardGrid>
              {references.genericReferences.map((reference) => (
                <ImageOverlayCard
                  key={reference.selectionId}
                  title={reference.title}
                  description={reference.mediaKind[0]!.toUpperCase() + reference.mediaKind.slice(1)}
                  imageUrl={reference.mediaKind === 'image'
                    ? reference.browserUrl ?? null
                    : null}
                  imageAlt={reference.title}
                  selected
                  topRightAction={(
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      aria-label={`Remove ${reference.title}`}
                      onClick={() => {
                        void mutationStatus.runTakeEditorMutation(async () => {
                          await onSetGenericReferences(
                            references.genericReferences
                              .filter((candidate) => candidate.selectionId !== reference.selectionId)
                              .map((candidate) => candidate.reference)
                          );
                        });
                      }}
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  )}
                  topRightActionPersistent
                  onOpen={() => setGenericPickerOpen(true)}
                />
              ))}
            </SceneShotReferenceCardGrid>
          ) : (
            <p className='text-sm text-muted-foreground'>No additional media selected.</p>
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
      {references?.kind === 'draft' ? (
        <GenericReferencePickerDialog
          open={genericPickerOpen}
          projectName={projectName}
          selected={references.genericReferences.map((reference) => ({
            reference: reference.reference,
            label: reference.title,
            mediaKind: reference.mediaKind,
            ...(reference.browserUrl ? { browserUrl: reference.browserUrl } : {}),
          }))}
          onOpenChange={setGenericPickerOpen}
          onChange={(nextReferences) => {
            void mutationStatus.runTakeEditorMutation(async () => {
              await onSetGenericReferences(
                nextReferences.map((reference) => reference.reference)
              );
            });
          }}
        />
      ) : null}
    </>
  );
}

function findReferenceCard(
  references: Extract<NonNullable<SceneShotReferencesTabProps['references']>, { kind: 'draft' }> | null,
  selectionId: string
) {
  if (!references) {
    return null;
  }
  const cards = [
    ...references.general.map((choice) => choice.card),
    ...references.lookbook.map((choice) => choice.card),
    ...references.castMembers.flatMap((group) => group.characterSheets.map((choice) => choice.card)),
    ...references.locations.flatMap((group) => group.environmentSheets.map((choice) => choice.card)),
  ];
  return cards.find((card) => card.selectionId === selectionId) ?? null;
}

function CompletedTakeReferences({
  references,
}: {
  references: Extract<NonNullable<SceneShotReferencesTabProps['references']>, { kind: 'completed' }>['usedReferences'];
}) {
  const groups = new Map<string, typeof references>();
  for (const reference of references) {
    const key = reference.sectionId ?? 'Additional';
    groups.set(key, [...(groups.get(key) ?? []), reference]);
  }
  return (
    <div className='flex flex-col gap-6 py-4'>
      {[...groups].map(([section, used]) => (
        <SceneShotReferenceSection key={section} title={sectionLabel(section)} defaultOpen>
          <SceneShotReferenceCardGrid>
            {used.map((reference) => (
              <div key={reference.selectionId} className='overflow-hidden rounded-md border bg-card'>
                {reference.browserUrl && reference.mediaKind === 'image' ? (
                  <img
                    src={reference.browserUrl}
                    alt={reference.title}
                    className='aspect-video w-full object-cover'
                  />
                ) : null}
                <p className='px-3 py-2 text-sm'>{reference.title}</p>
              </div>
            ))}
          </SceneShotReferenceCardGrid>
        </SceneShotReferenceSection>
      ))}
      {references.length === 0 ? (
        <p className='text-sm text-muted-foreground'>No references were used by this completed request.</p>
      ) : null}
    </div>
  );
}

function sectionLabel(section: string): string {
  if (section === 'take-media') return 'General';
  if (section === 'visual-language') return 'Lookbook';
  if (section === 'cast') return 'Cast Character Sheets';
  if (section === 'location') return 'Location Sheets';
  if (section === 'dialogue') return 'Dialogue Audio';
  return section;
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
