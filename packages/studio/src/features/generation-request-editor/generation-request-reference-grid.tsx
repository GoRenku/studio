import { useState } from 'react';
import type {
  GenerationPreviewReferenceSlot,
  GenerationPreviewResource,
  GenerationPreviewResourceReference,
} from '@gorenku/studio-core/client';
import { ReferencePickerDialog } from '@/features/reference-picker/reference-picker-dialog';
import type { GenerationPreviewDraft } from '@/features/generation-preview/generation-preview-draft';
import { generationPreviewReferenceSelected } from '@/features/generation-preview/generation-preview-draft';
import { Button } from '@/ui/button';
import { GenerationRequestReferenceCard } from './generation-request-reference-card';

interface GenerationRequestReferenceGridProps {
  preview: GenerationPreviewResource;
  draft: GenerationPreviewDraft;
  updating: boolean;
  editable?: boolean;
  onReferenceChoose?: (
    slot: GenerationPreviewReferenceSlot,
    reference: GenerationPreviewResourceReference | null,
  ) => void;
}

export function GenerationRequestReferenceGrid({
  preview,
  draft,
  updating,
  editable,
  onReferenceChoose,
}: GenerationRequestReferenceGridProps) {
  const [openSlot, setOpenSlot] = useState<GenerationPreviewReferenceSlot | null>(null);
  const canEdit = (editable ?? preview.generationSpec?.frozenAt === null) &&
    Boolean(onReferenceChoose);
  const visibleSlots = preview.references.slots.filter(
    (slot) => (canEdit && !slot.locked) || Boolean(slot.current),
  );
  if (!visibleSlots.length && !preview.references.additional.length && !canEdit) {
    return (
      <p className='mx-auto w-full max-w-[900px] pt-[38px] text-sm text-muted-foreground'>
        No references are attached.
      </p>
    );
  }
  return (
    <>
      <div className='mx-auto w-full max-w-[900px] space-y-[30px] pt-[38px] pb-12'>
        {visibleSlots.map((slot) => {
          const canEditSlot = canEdit && !slot.locked;
          const selected = [slot.current, ...slot.eligibleCandidates]
            .filter((reference): reference is GenerationPreviewResourceReference => Boolean(reference))
            .find((reference) => generationPreviewReferenceSelected(slot, reference, draft)) ?? null;
          const soleCandidate = canEditSlot && !selected && slot.eligibleCandidates.length === 1
            ? slot.eligibleCandidates[0]!
            : null;
          return (
            <section key={slotKey(slot)} className='space-y-[15px]'>
              <h3 className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                {slot.label}
              </h3>
              <div className='grid grid-cols-[repeat(2,minmax(0,420px))] gap-5'>
                {selected || soleCandidate ? (
                  <GenerationRequestReferenceCard
                    reference={(selected ?? soleCandidate)!}
                    selected={Boolean(selected)}
                    onOpen={canEditSlot && !updating && slot.eligibleCandidates.length > 1
                      ? () => setOpenSlot(slot)
                      : undefined}
                    onToggleSelected={canEditSlot && !updating
                      ? () => onReferenceChoose?.(slot, selected ? null : soleCandidate)
                      : undefined}
                  />
                ) : slot.eligibleCandidates.length > 0 ? (
                  <Button
                    type='button'
                    variant='outline'
                    disabled={!canEditSlot || updating}
                    onClick={() => setOpenSlot(slot)}
                  >
                    Choose {slot.label}
                  </Button>
                ) : (
                  <p className='text-sm text-muted-foreground'>No {slot.label} is available.</p>
                )}
              </div>
            </section>
          );
        })}
        {preview.references.additional.length ? (
          <section className='space-y-[15px]'>
            <h3 className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
              Additional Media
            </h3>
            <div className='grid grid-cols-[repeat(2,minmax(0,420px))] gap-5'>
              {preview.references.additional.map((reference) => (
                <GenerationRequestReferenceCard
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
          description={`Choose the exact ${openSlot.label} for this generation request.`}
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
    slot.placement.subject?.kind, slot.placement.subject?.id]
    .filter(Boolean)
    .join(':');
}
