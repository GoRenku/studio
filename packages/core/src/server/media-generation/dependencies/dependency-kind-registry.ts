import type {
  MediaGenerationDependencyKind,
  MediaGenerationDependencyKindDefinition,
} from '../../../client/index.js';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  SHOT_LAST_FRAME_GENERATION_PURPOSE,
  SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
  SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
} from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';

const DEPENDENCY_KIND_DEFINITIONS = [
  {
    dependencyKind: 'first-frame',
    mediaKind: 'image',
    cardinality: 'one',
    assetSelector: 'shot-video-input',
    missingInputBehavior: 'plan-generation',
    generationPurpose: SHOT_FIRST_FRAME_GENERATION_PURPOSE,
  },
  {
    dependencyKind: 'last-frame',
    mediaKind: 'image',
    cardinality: 'one',
    assetSelector: 'shot-video-input',
    missingInputBehavior: 'plan-generation',
    generationPurpose: SHOT_LAST_FRAME_GENERATION_PURPOSE,
  },
  {
    dependencyKind: 'reference-image',
    mediaKind: 'image',
    cardinality: 'one',
    assetSelector: 'shot-video-input',
    missingInputBehavior: 'plan-generation',
    generationPurpose: SHOT_REFERENCE_IMAGE_GENERATION_PURPOSE,
  },
  {
    dependencyKind: 'video-prompt-sheet',
    mediaKind: 'image',
    cardinality: 'one',
    assetSelector: 'shot-video-input',
    missingInputBehavior: 'plan-generation',
    generationPurpose: SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
  },
  {
    dependencyKind: 'reference-audio',
    mediaKind: 'audio',
    cardinality: 'one',
    assetSelector: 'shot-video-input',
    missingInputBehavior: 'plan-generation',
    generationPurpose: SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE,
  },
  {
    dependencyKind: 'cast-character-sheet',
    mediaKind: 'image',
    cardinality: 'one',
    assetSelector: 'cast-character-sheet',
    missingInputBehavior: 'plan-generation',
    generationPurpose: CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  },
  {
    dependencyKind: 'cast-reference-image',
    mediaKind: 'image',
    cardinality: 'one',
    assetSelector: 'cast-reference-image',
    missingInputBehavior: 'require-attachment',
  },
  {
    dependencyKind: 'location-environment-sheet',
    mediaKind: 'image',
    cardinality: 'one',
    assetSelector: 'location-environment-sheet',
    missingInputBehavior: 'plan-generation',
    generationPurpose: LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  },
  {
    dependencyKind: 'lookbook-sheet',
    mediaKind: 'image',
    cardinality: 'one',
    assetSelector: 'lookbook-sheet',
    missingInputBehavior: 'plan-generation',
    generationPurpose: LOOKBOOK_SHEET_GENERATION_PURPOSE,
  },
  {
    dependencyKind: 'manual-attachment',
    mediaKind: 'image',
    cardinality: 'one',
    assetSelector: 'manual-attachment',
    missingInputBehavior: 'require-attachment',
  },
] satisfies MediaGenerationDependencyKindDefinition[];

const DEPENDENCY_KIND_DEFINITIONS_BY_KIND = new Map<
  MediaGenerationDependencyKind,
  MediaGenerationDependencyKindDefinition
>(
  DEPENDENCY_KIND_DEFINITIONS.map((definition) => [
    definition.dependencyKind,
    definition,
  ])
);

export function listMediaGenerationDependencyKindDefinitions():
  MediaGenerationDependencyKindDefinition[] {
  return [...DEPENDENCY_KIND_DEFINITIONS];
}

export function requireMediaGenerationDependencyKindDefinition(
  dependencyKind: MediaGenerationDependencyKind
): MediaGenerationDependencyKindDefinition {
  const definition = DEPENDENCY_KIND_DEFINITIONS_BY_KIND.get(dependencyKind);
  if (!definition) {
    throw new ProjectDataError(
      'CORE_MEDIA_DEPENDENCY_UNREGISTERED_KIND',
      `Unsupported media generation dependency kind: ${dependencyKind}.`,
      {
        suggestion:
          'Register the dependency kind before declaring it from a media generation purpose.',
      }
    );
  }
  return definition;
}
