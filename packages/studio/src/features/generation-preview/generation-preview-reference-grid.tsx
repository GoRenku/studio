import { useState } from 'react';
import type {
  GenerationPreviewReferenceSlot,
  GenerationPreviewResource,
  GenerationPreviewResourceReference,
} from '@gorenku/studio-core/client';
import type { GenerationPreviewDraft } from './generation-preview-draft';
import { generationPreviewReferenceSelected } from './generation-preview-draft';
import { GenerationPreviewReferenceCard } from './generation-preview-reference-card';
import { Button } from '@/ui/button';
import {
  GenericReferencePickerDialog,
  ReferencePickerDialog,
  type GenericReferencePickerValue,
} from '@/features/reference-picker/reference-picker-dialog';

interface GenerationPreviewReferenceGridProps {
  preview: GenerationPreviewResource;
  draft: GenerationPreviewDraft;
  updating: boolean;
  editable?: boolean;
  onReferenceChoose?: (
    slot: GenerationPreviewReferenceSlot,
    reference: GenerationPreviewResourceReference | null
  ) => void;
  onGenericReferencesChange?: (
    references: GenerationPreviewResourceReference[],
  ) => void;
}

export function GenerationPreviewReferenceGrid({
  preview,
  draft,
  updating,
  editable,
  onReferenceChoose,
  onGenericReferencesChange,
}: GenerationPreviewReferenceGridProps) {
  const [openSlot, setOpenSlot] = useState<GenerationPreviewReferenceSlot | null>(null);
  const [genericPickerOpen, setGenericPickerOpen] = useState(false);
  const canEdit = (editable ?? Boolean(preview.generationSpecId)) &&
    Boolean(onReferenceChoose && onGenericReferencesChange);
  const visibleSlots = preview.references.slots.filter(
    (slot) => canEdit || Boolean(slot.current),
  );
  const hasReferences = visibleSlots.length > 0 ||
    draft.genericReferences.length > 0 || canEdit;
  if (!hasReferences) {
    return <p className='text-sm text-muted-foreground'>No references are attached to this preview.</p>;
  }

  return (
    <>
      <div className='space-y-6'>
        {visibleSlots.map((slot) => {
          const selected = [slot.current, ...slot.eligibleCandidates].filter(
            (reference): reference is GenerationPreviewResourceReference => Boolean(reference)
          ).find((reference) =>
            generationPreviewReferenceSelected(slot, reference, draft)
          ) ?? null;
          const soleCandidate = canEdit &&
            !selected &&
            slot.eligibleCandidates.length === 1
            ? slot.eligibleCandidates[0]!
            : null;
          return (
            <section key={slotKey(slot)} className='space-y-2'>
              <h3 className='text-sm font-semibold'>{slot.label}</h3>
              <div className='grid grid-cols-3 gap-3'>
                {selected || soleCandidate ? (
                  <GenerationPreviewReferenceCard
                    reference={(selected ?? soleCandidate)!}
                    selected={Boolean(selected)}
                    onOpen={
                      canEdit && !updating
                        ? () => setOpenSlot(slot)
                        : undefined
                    }
                  />
                ) : (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={!canEdit || updating}
                    onClick={() => setOpenSlot(slot)}
                  >
                    Choose {slot.label}
                  </Button>
                )}
              </div>
            </section>
          );
        })}
        {draft.genericReferences.length || canEdit ? (
          <section className='space-y-2'>
            <div className='flex items-center justify-between gap-3'>
              <h3 className='text-sm font-semibold'>Additional Media</h3>
              {canEdit ? (
                <Button
                  type='button'
                  variant='outline'
                  disabled={updating}
                  onClick={() => setGenericPickerOpen(true)}
                >
                  {draft.genericReferences.length ? 'Manage Media' : 'Add Media'}
                </Button>
              ) : null}
            </div>
            {draft.genericReferences.length ? (
              <div className='grid grid-cols-3 gap-3'>
                {draft.genericReferences.map((reference) => (
                  <GenerationPreviewReferenceCard
                    key={`${reference.assetId}:${reference.assetFileId}`}
                    reference={reference}
                    selected
                    onOpen={
                      canEdit && !updating
                        ? () => setGenericPickerOpen(true)
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>No additional media selected.</p>
            )}
          </section>
        ) : null}
      </div>
      {openSlot ? (
        <ReferencePickerDialog
          open
          onOpenChange={(open) => !open && setOpenSlot(null)}
          title={openSlot.label}
          description={`Choose the exact ${openSlot.label} for this saved generation request.`}
          candidates={openSlot.eligibleCandidates.map((reference) => ({
            id: `${reference.assetId}:${reference.assetFileId}`,
            title: reference.label,
            imageUrl: reference.kind === 'image' ? reference.browserUrl : null,
            imageAlt: reference.label,
            selected: generationPreviewReferenceSelected(openSlot, reference, draft),
          }))}
          onChoose={(candidateId) => {
            const reference = candidateId
              ? openSlot.eligibleCandidates.find((candidate) =>
                  `${candidate.assetId}:${candidate.assetFileId}` === candidateId
                ) ?? null
              : null;
            onReferenceChoose?.(openSlot, reference);
            setOpenSlot(null);
          }}
        />
      ) : null}
      {canEdit ? (
        <GenericReferencePickerDialog
          open={genericPickerOpen}
          projectName={preview.project.name}
          selected={draft.genericReferences.map((reference) => ({
            reference: {
              kind: 'asset-file',
              assetId: reference.assetId,
              assetFileId: reference.assetFileId,
            },
            label: reference.label,
            mediaKind: reference.kind,
            browserUrl: reference.browserUrl,
          }))}
          onOpenChange={setGenericPickerOpen}
          onChange={(values) => onGenericReferencesChange?.(
            values.map(genericPickerValueToPreviewReference)
          )}
        />
      ) : null}
    </>
  );
}

function genericPickerValueToPreviewReference(
  value: GenericReferencePickerValue,
): GenerationPreviewResourceReference {
  if (value.reference.kind !== 'asset-file') {
    throw new Error('Studio generic media must identify an AssetFile.');
  }
  return {
    kind: value.mediaKind,
    role: 'generic-reference',
    label: value.label,
    assetId: value.reference.assetId,
    assetFileId: value.reference.assetFileId,
    selected: true,
    browserUrl: value.browserUrl ?? '',
  };
}

function slotKey(slot: GenerationPreviewReferenceSlot): string {
  return [slot.placement.sectionId, slot.placement.slotId,
    slot.placement.subject?.kind, slot.placement.subject?.id].filter(Boolean).join(':');
}
