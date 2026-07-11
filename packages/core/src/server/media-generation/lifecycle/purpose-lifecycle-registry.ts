import type { MediaGenerationPurpose } from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import { castCharacterSheetPurposeDefinition } from './purpose-definitions/cast-character-sheet.js';
import { castProfilePurposeDefinition } from './purpose-definitions/cast-profile.js';
import { castVoiceSamplePurposeDefinition } from './purpose-definitions/cast-voice-sample.js';
import { imageCreatePurposeDefinition } from './purpose-definitions/image-create.js';
import { imageEditPurposeDefinition } from './purpose-definitions/image-edit.js';
import { locationEnvironmentSheetPurposeDefinition } from './purpose-definitions/location-environment-sheet.js';
import { locationHeroPurposeDefinition } from './purpose-definitions/location-hero.js';
import { lookbookImagePurposeDefinition } from './purpose-definitions/lookbook-image.js';
import { lookbookSheetPurposeDefinition } from './purpose-definitions/lookbook-sheet.js';
import { sceneDialogueAudioPurposeDefinition } from './purpose-definitions/scene-dialogue-audio.js';
import { sceneStoryboardSheetPurposeDefinition } from './purpose-definitions/scene-storyboard-sheet.js';
import { shotVideoTakePurposeDefinition } from './purpose-definitions/shot-video-take.js';
import type { MediaGenerationPurposeDefinition } from './purpose-definition.js';

const DEFINITIONS = [
  imageCreatePurposeDefinition,
  imageEditPurposeDefinition,
  lookbookImagePurposeDefinition,
  lookbookSheetPurposeDefinition,
  castCharacterSheetPurposeDefinition,
  castProfilePurposeDefinition,
  castVoiceSamplePurposeDefinition,
  sceneDialogueAudioPurposeDefinition,
  locationEnvironmentSheetPurposeDefinition,
  locationHeroPurposeDefinition,
  sceneStoryboardSheetPurposeDefinition,
  shotVideoTakePurposeDefinition,
] satisfies MediaGenerationPurposeDefinition[];

const DEFINITIONS_BY_PURPOSE = new Map<
  MediaGenerationPurpose,
  MediaGenerationPurposeDefinition
>(DEFINITIONS.map((definition) => [definition.purpose, definition]));

export function listMediaGenerationPurposeDefinitions(): MediaGenerationPurposeDefinition[] {
  return [...DEFINITIONS];
}

export function requireMediaGenerationPurposeDefinition(
  purpose: string,
): MediaGenerationPurposeDefinition {
  const definition = DEFINITIONS_BY_PURPOSE.get(
    purpose as MediaGenerationPurpose,
  );
  if (!definition) {
    throw new ProjectDataError(
      'PROJECT_DATA387',
      `Unsupported media generation purpose: ${purpose}.`,
      {
        suggestion:
          'Use one of the registered media generation purposes from the core purpose registry.',
      },
    );
  }
  return definition;
}

export function assertRegisteredMediaGenerationPurpose(
  purpose: string,
): asserts purpose is MediaGenerationPurpose {
  requireMediaGenerationPurposeDefinition(purpose);
}
