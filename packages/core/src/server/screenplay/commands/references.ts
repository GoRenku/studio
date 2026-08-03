import type { Screenplay, ScreenplayReference } from '../../../client/screenplay/index.js';
import { ProjectDataError } from '../../project-data-error.js';

export function addScreenplayReference(
  screenplay: Screenplay,
  reference: ScreenplayReference,
): void {
  if (screenplay.references.some((value) => value.id === reference.id)) {
    throw new ProjectDataError(
      'SCREENPLAY_INVALID_CONTENT',
      `Screenplay Reference ${reference.id} already exists.`,
    );
  }
  screenplay.references.push(reference);
}

export function deleteScreenplayReference(
  screenplay: Screenplay,
  referenceId: string,
): void {
  if (!screenplay.references.some((value) => value.id === referenceId)) {
    throw new ProjectDataError(
      'SCREENPLAY_REFERENCE_TARGET_NOT_FOUND',
      `Screenplay Reference ${referenceId} does not exist.`,
    );
  }
  screenplay.references = screenplay.references.filter(
    (value) => value.id !== referenceId,
  );
}
