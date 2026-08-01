import type {
  GenerationModelDescriptor,
  GenerationSpec,
  ShotPlanVideoInputMode,
} from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { resolveGenerationReference } from './references.js';

type VideoInputMediaRole =
  | 'reference-image'
  | 'source-video'
  | 'audio'
  | 'last-frame'
  | 'first-frame'
  | 'source-image';

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
          model: input.model,
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
  model: GenerationModelDescriptor;
}): string | null {
  const roles = videoInputMediaRoles(input);
  return input.model.fields.find((field) =>
    field.media?.acceptedKinds.includes(input.mediaKind) &&
    field.semantic?.kind === 'media' &&
    roles.includes(field.semantic.role)
  )?.name ?? null;
}

function videoInputMediaRoles(input: {
  inputMode: ShotPlanVideoInputMode;
  mediaKind: 'image' | 'audio' | 'video';
  slotId: string | null;
}): VideoInputMediaRole[] {
  if (input.inputMode === 'reference') {
    if (input.mediaKind === 'image') {
      return ['reference-image'];
    }
    if (input.mediaKind === 'video') {
      return ['source-video'];
    }
    return ['audio'];
  }
  if (input.mediaKind !== 'image') {
    return [];
  }
  if (
    input.inputMode === 'first-last-frame' &&
    input.slotId === 'last-frame'
  ) {
    return ['last-frame'];
  }
  if (
    (input.inputMode === 'first-frame' ||
      input.inputMode === 'first-last-frame') &&
    input.slotId === 'first-frame'
  ) {
    return ['first-frame', 'source-image'];
  }
  return [];
}
