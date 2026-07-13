import type { GenerationModelDescriptor, GenerationOutputMediaKind, GenerationPurpose } from '../../client/generation.js';
import { bindGenerationProductSettings, describeGenerationModelInputs, listStudioModelAvailability, type StudioGenerationUse } from '@gorenku/studio-engines';
import { ProjectDataError } from '../project-data-error.js';
import type { GenerationPurposeDescriptor } from './purpose-contract.js';
import { imageCreatePurpose } from './purposes/image-create.js';
import { imageEditPurpose } from './purposes/image-edit.js';
import { lookbookImagePurpose } from './purposes/lookbook-image.js';
import { lookbookVideoSheetPurpose } from './purposes/lookbook-video-sheet.js';
import { lookbookStoryboardSheetPurpose } from './purposes/lookbook-storyboard-sheet.js';
import { castVideoCharacterSheetPurpose } from './purposes/cast-video-character-sheet.js';
import { castStoryboardCharacterSheetPurpose } from './purposes/cast-storyboard-character-sheet.js';
import { castProfilePurpose } from './purposes/cast-profile.js';
import { castVoiceSamplePurpose } from './purposes/cast-voice-sample.js';
import { sceneDialogueAudioPurpose } from './purposes/scene-dialogue-audio.js';
import { locationSheetPurpose } from './purposes/location-sheet.js';
import { locationHeroPurpose } from './purposes/location-hero.js';
import { sceneStoryboardSheetPurpose } from './purposes/scene-storyboard-sheet.js';
import { shotVideoTakePurpose } from './purposes/shot-video-take.js';

const descriptors: GenerationPurposeDescriptor[] = [imageCreatePurpose, imageEditPurpose, lookbookImagePurpose, lookbookVideoSheetPurpose, lookbookStoryboardSheetPurpose, castVideoCharacterSheetPurpose, castStoryboardCharacterSheetPurpose, castProfilePurpose, castVoiceSamplePurpose, sceneDialogueAudioPurpose, locationSheetPurpose, locationHeroPurpose, sceneStoryboardSheetPurpose, shotVideoTakePurpose];
const descriptorByPurpose = new Map(descriptors.map((descriptor) => [descriptor.purpose, descriptor]));

export function listGenerationPurposes(): GenerationPurposeDescriptor[] { return [...descriptors]; }
export function readGenerationPurpose(purpose: GenerationPurpose): GenerationPurposeDescriptor {
  const descriptor = descriptorByPurpose.get(purpose);
  if (!descriptor) {
    throw new ProjectDataError('CORE_GENERATION_PURPOSE_INVALID', `Unsupported generation purpose: ${purpose}.`);
  }
  return descriptor;
}
export function isGenerationPurpose(value: string): value is GenerationPurpose { return descriptorByPurpose.has(value as GenerationPurpose); }

export async function listGenerationModels(input: { outputMediaKind?: GenerationOutputMediaKind; use?: StudioGenerationUse; fixedSettings?: GenerationPurposeDescriptor['settings']['fixed'] } = {}): Promise<GenerationModelDescriptor[]> {
  const availability = await listStudioModelAvailability({ mediaKind: input.outputMediaKind, use: input.use });
  const models = await Promise.all(availability.map(async (available) => {
    const descriptor = await describeGenerationModelInputs(available);
    return descriptor ? { descriptor, label: available.label } : null;
  }));
  return models.filter((model): model is NonNullable<typeof model> => {
    if (!model) {
      return false;
    }
    if (!input.fixedSettings?.length) {
      return true;
    }
    return bindGenerationProductSettings({
      descriptor: model.descriptor,
      settings: input.fixedSettings.map((setting) => ({
        kind: setting.kind,
        value: setting.value as string | number | boolean | null,
      })),
    }).valid;
  }).map(({ descriptor, label }) => ({ ...descriptor, label }) as GenerationModelDescriptor);
}
