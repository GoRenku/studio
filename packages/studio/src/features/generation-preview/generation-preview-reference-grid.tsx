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
  onReferenceChoose: (
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
  const canEdit = editable ?? Boolean(preview.generationSpecId);
  const hasReferences = preview.references.slots.length > 0 ||
    preview.references.additional.length > 0;
  if (!hasReferences) {
    return <p className='text-sm text-muted-foreground'>No references are attached to this preview.</p>;
  }

  return (
    <>
      <div className='space-y-6'>
        {preview.references.slots.map((slot) => {
          const selected = slot.candidates.find((reference) =>
            generationPreviewReferenceSelected(slot, reference, draft)
          ) ?? null;
          return (
            <section key={slotKey(slot)} className='space-y-2'>
              <h3 className='text-sm font-semibold'>{slot.label}</h3>
              <div className='grid grid-cols-3 gap-3'>
                {selected ? (
                  <GenerationPreviewReferenceCard
                    reference={selected}
                    selected
                    onOpen={() => canEdit && !updating && setOpenSlot(slot)}
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
        {preview.references.additional.length ? (
          <section className='space-y-2'>
            <h3 className='text-sm font-semibold'>Additional</h3>
            <div className='grid grid-cols-3 gap-3'>
              {preview.references.additional.map((reference) => (
                <GenerationPreviewReferenceCard
                  key={`${reference.assetId}:${reference.assetFileId}`}
                  reference={reference}
                  selected={reference.selected}
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
          candidates={openSlot.candidates.map((reference) => ({
            id: `${reference.assetId}:${reference.assetFileId}`,
            title: reference.label,
            imageUrl: reference.kind === 'image' ? reference.browserUrl : null,
            imageAlt: reference.label,
            selected: generationPreviewReferenceSelected(openSlot, reference, draft),
          }))}
          onChoose={(candidateId) => {
            const reference = candidateId
              ? openSlot.candidates.find((candidate) =>
                  `${candidate.assetId}:${candidate.assetFileId}` === candidateId
                ) ?? null
              : null;
            onReferenceChoose(openSlot, reference);
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
