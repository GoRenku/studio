import type {
  GenerationModelDescriptor,
  GenerationSpec,
  ShotPlanVideoInputMode,
} from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { resolveGenerationReference } from './references.js';

export async function routeShotPlanVideoReferences(input: {
  spec: GenerationSpec;
  inputMode: ShotPlanVideoInputMode;
  model: GenerationModelDescriptor;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<GenerationSpec> {
  const routed = await Promise.all(input.spec.references.map(async (selection) => {
    const resolved = await resolveGenerationReference({
      session: input.session,
      projectFolder: input.projectFolder,
      reference: selection.reference,
    });
    const providerField = resolved
      ? shotPlanVideoProviderFieldForReference({
          inputMode: input.inputMode,
          mediaKind: resolved.mediaKind,
          slotId: selection.placement.kind === 'slot'
            ? selection.placement.slotId
            : null,
        })
      : null;
    if (!providerField || !input.model.fields.some((field) =>
      field.name === providerField &&
      field.media?.acceptedKinds.includes(resolved!.mediaKind)
    )) {
      const { providerField: _providerField, ...unassigned } = selection;
      return unassigned;
    }
    return { ...selection, providerField };
  }));
  return { ...input.spec, references: routed };
}

export function shotPlanVideoProviderFieldForReference(input: {
  inputMode: ShotPlanVideoInputMode;
  mediaKind: 'image' | 'audio' | 'video';
  slotId: string | null;
}): string | null {
  if (input.inputMode === 'reference') {
    return input.mediaKind === 'image'
      ? 'image_urls'
      : input.mediaKind === 'video'
        ? 'video_urls'
        : 'audio_urls';
  }
  if (input.mediaKind !== 'image') {
    return null;
  }
  if (
    input.inputMode === 'first-last-frame' &&
    input.slotId === 'last-frame'
  ) {
    return 'end_image_url';
  }
  if (
    (input.inputMode === 'first-frame' ||
      input.inputMode === 'first-last-frame') &&
    input.slotId === 'first-frame'
  ) {
    return 'image_url';
  }
  return null;
}
