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
import { ReferencePickerDialog } from '@/features/reference-picker/reference-picker-dialog';

interface GenerationPreviewReferenceGridProps {
  preview: GenerationPreviewResource;
  draft: GenerationPreviewDraft;
  updating: boolean;
  editable?: boolean;
  onReferenceChoose?: (
    slot: GenerationPreviewReferenceSlot,
    reference: GenerationPreviewResourceReference | null
  ) => void;
}

export function GenerationPreviewReferenceGrid({
  preview,
  draft,
  updating,
  editable,
  onReferenceChoose,
}: GenerationPreviewReferenceGridProps) {
  const [openSlot, setOpenSlot] = useState<GenerationPreviewReferenceSlot | null>(null);
  const canEdit = (editable ?? Boolean(preview.generationSpecId)) &&
    Boolean(onReferenceChoose);
  const visibleSlots = preview.references.slots.filter(
    (slot) => canEdit || Boolean(slot.current),
  );
  const hasReferences = visibleSlots.length > 0 ||
    preview.references.additional.length > 0 || canEdit;
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
                      canEdit &&
                      !updating &&
                      slot.eligibleCandidates.length > 1
                        ? () => setOpenSlot(slot)
                        : undefined
                    }
                    onToggleSelected={
                      canEdit && !updating
                        ? () => onReferenceChoose?.(
                            slot,
                            selected ? null : soleCandidate
                          )
                        : undefined
                    }
                  />
                ) : slot.eligibleCandidates.length > 0 ? (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={!canEdit || updating}
                    onClick={() => setOpenSlot(slot)}
                  >
                    Choose {slot.label}
                  </Button>
                ) : (
                  <p className='text-sm text-muted-foreground'>
                    No {slot.label} is available.
                  </p>
                )}
              </div>
            </section>
          );
        })}
        {preview.references.additional.length ? (
          <section className='space-y-2'>
            <h3 className='text-sm font-semibold'>Additional Media</h3>
            <div className='grid grid-cols-3 gap-3'>
              {preview.references.additional.map((reference) => (
                <GenerationPreviewReferenceCard
                  key={`${reference.assetId}:${reference.assetFileId}`}
                  reference={reference}
                  selected
                />
              ))}
            </div>
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
            const reference = openSlot.eligibleCandidates.find((candidate) =>
              `${candidate.assetId}:${candidate.assetFileId}` === candidateId
            ) ?? null;
            onReferenceChoose?.(openSlot, reference);
            setOpenSlot(null);
          }}
        />
      ) : null}
    </>
  );
}

function slotKey(slot: GenerationPreviewReferenceSlot): string {
  return [slot.placement.sectionId, slot.placement.slotId,
    slot.placement.subject?.kind, slot.placement.subject?.id].filter(Boolean).join(':');
}
