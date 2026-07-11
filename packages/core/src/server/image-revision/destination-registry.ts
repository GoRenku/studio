import type { ImageRevisionTarget } from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import type { ImageRevisionDestinationDefinition } from './destination-definition.js';
import { castCharacterSheetRevisionDestination } from './destinations/cast-character-sheet.js';
import { locationEnvironmentSheetRevisionDestination } from './destinations/location-environment-sheet.js';
import { lookbookImageRevisionDestination } from './destinations/lookbook-image.js';
import { lookbookSheetRevisionDestination } from './destinations/lookbook-sheet.js';
import { shotVideoTakeInputRevisionDestination } from './destinations/shot-video-take-input.js';

const DESTINATIONS = new Map<
  ImageRevisionTarget['kind'],
  ImageRevisionDestinationDefinition
>(
  [
    castCharacterSheetRevisionDestination,
    locationEnvironmentSheetRevisionDestination,
    lookbookImageRevisionDestination,
    lookbookSheetRevisionDestination,
    shotVideoTakeInputRevisionDestination,
  ].map((definition) => [definition.kind, definition]),
);

export function requireImageRevisionDestination(
  kind: ImageRevisionTarget['kind'],
): ImageRevisionDestinationDefinition {
  const definition = DESTINATIONS.get(kind);
  if (!definition) {
    throw new ProjectDataError(
      'CORE_IMAGE_REVISION_TARGET_UNSUPPORTED',
      `Image Revision target is not supported: ${kind}.`,
    );
  }
  return definition;
}
