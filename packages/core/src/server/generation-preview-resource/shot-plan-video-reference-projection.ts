import type {
  GenerationModelDescriptor,
  GenerationReferenceSelection,
  ShotPlanVideoInputMode,
} from '../../client/generation.js';
import { shotPlanVideoProviderFieldForReference } from '../generation/shot-plan-video-reference-routing.js';

const METHOD_SLOT_IDS_BY_MODE: Record<
  Exclude<ShotPlanVideoInputMode, 'reference'>,
  ReadonlySet<string>
> = {
  'text-only': new Set(),
  'first-frame': new Set(['first-frame']),
  'first-last-frame': new Set(['first-frame', 'last-frame']),
};

export function shotPlanVideoPreviewIncludesReferenceSlot(input: {
  inputMode: ShotPlanVideoInputMode;
  placement: Extract<
    GenerationReferenceSelection['placement'],
    { kind: 'slot' }
  >;
  mediaKind: 'image' | 'audio' | 'video';
  hasCurrent: boolean;
  eligibleCandidateCount: number;
  model?: GenerationModelDescriptor;
}): boolean {
  if (input.hasCurrent) {
    return true;
  }
  if (input.inputMode !== 'reference') {
    return (
      input.placement.sectionId === 'method-references' &&
      METHOD_SLOT_IDS_BY_MODE[input.inputMode].has(input.placement.slotId)
    );
  }
  if (
    input.placement.sectionId === 'method-references' &&
    input.placement.slotId !== 'video-storyboard'
  ) {
    return false;
  }
  if (!selectedModelAcceptsReference(input)) {
    return false;
  }
  if (input.eligibleCandidateCount > 0) {
    return true;
  }
  return (
    input.placement.subject?.kind === 'castMember' ||
    input.placement.subject?.kind === 'location'
  );
}

function selectedModelAcceptsReference(input: {
  inputMode: ShotPlanVideoInputMode;
  placement: Extract<
    GenerationReferenceSelection['placement'],
    { kind: 'slot' }
  >;
  mediaKind: 'image' | 'audio' | 'video';
  model?: GenerationModelDescriptor;
}): boolean {
  if (!input.model) {
    return false;
  }
  const providerField = shotPlanVideoProviderFieldForReference({
    inputMode: input.inputMode,
    mediaKind: input.mediaKind,
    slotId: input.placement.slotId,
  });
  return Boolean(
    providerField &&
      input.model.fields.some(
        (field) =>
          field.name === providerField &&
          field.media?.acceptedKinds.includes(input.mediaKind)
      )
  );
}
