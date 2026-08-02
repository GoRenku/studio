import type {
  GenerationPreviewReferenceSlot,
  GenerationPreviewResource,
  GenerationPreviewResourceReference,
} from '@gorenku/studio-core/client';
import type { GenerationPreviewDraft } from '@/features/generation-preview/generation-preview-draft';
import { generationPreviewReferenceSelected } from '@/features/generation-preview/generation-preview-draft';
import { MediaCard } from '@/ui/media-card/media-card';
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
          const references = uniqueReferences(
            canEditSlot
              ? [slot.current, ...slot.eligibleCandidates]
              : [slot.current]
          );
          return (
            <section key={slotKey(slot)} className='space-y-[15px]'>
              <h3 className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
                {slot.label}
              </h3>
              <div className='grid grid-cols-[repeat(2,minmax(0,420px))] gap-5'>
                {references.length > 0 ? (
                  references.map((reference) => {
                    const referenceSelected =
                      generationPreviewReferenceSelected(
                        slot,
                        reference,
                        draft
                      );
                    return (
                      <GenerationRequestReferenceCard
                        key={referenceIdentityKey(reference)}
                        reference={reference}
                        contextLabel={slot.label}
                        selected={referenceSelected}
                        onToggleSelected={canEditSlot && !updating
                          ? () =>
                              onReferenceChoose?.(
                                slot,
                                referenceSelected ? null : reference
                              )
                          : undefined}
                      />
                    );
                  })
                ) : (
                  <GenerationRequestReferenceEmptyCard slot={slot} />
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
              {preview.references.additional.map((reference, index) => (
                <GenerationRequestReferenceCard
                  key={referenceIdentityKey(reference)}
                  reference={reference}
                  contextLabel={`Additional ${reference.kind} reference ${index + 1}`}
                  selected
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}

function GenerationRequestReferenceEmptyCard({
  slot,
}: {
  slot: GenerationPreviewReferenceSlot;
}) {
  return (
    <MediaCard
      media={null}
      frame={{ kind: 'ratio', aspectRatio: 16 / 10 }}
      presentation={{
        kind: 'overlay',
        copy: { description: emptyReferenceDescription(slot) },
      }}
      emptyState={{ kind: emptyReferenceMediaKind(slot) }}
    />
  );
}

function emptyReferenceDescription(
  slot: GenerationPreviewReferenceSlot,
): string {
  if (slot.placement.subject?.kind === 'castMember') {
    return `No character sheet exists for ${slot.label}.`;
  }
  if (slot.placement.subject?.kind === 'location') {
    return `No location sheet exists for ${slot.label}.`;
  }
  return `No ${slot.label.toLocaleLowerCase()} is available.`;
}

function emptyReferenceMediaKind(
  slot: GenerationPreviewReferenceSlot,
): 'image' | 'film' | 'waveform' {
  if (slot.mediaKind === 'audio') {
    return 'waveform';
  }
  return slot.mediaKind === 'video' ? 'film' : 'image';
}

function uniqueReferences(
  references: Array<GenerationPreviewResourceReference | null>
): GenerationPreviewResourceReference[] {
  const unique = new Map<string, GenerationPreviewResourceReference>();
  for (const reference of references) {
    if (reference) {
      unique.set(referenceIdentityKey(reference), reference);
    }
  }
  return [...unique.values()];
}

function referenceIdentityKey(
  reference: GenerationPreviewResourceReference,
): string {
  return reference.identity.kind === 'asset-file'
    ? `${reference.identity.assetId}:${reference.identity.assetFileId}`
    : `project-file:${reference.browserUrl}`;
}

function slotKey(slot: GenerationPreviewReferenceSlot): string {
  return [slot.placement.sectionId, slot.placement.slotId,
    slot.placement.subject?.kind, slot.placement.subject?.id]
    .filter(Boolean)
    .join(':');
}
