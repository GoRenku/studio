import type { Screenplay, TextBlock } from '../../../client/screenplay/index.js';

export function replaceScreenplayOpening(
  screenplay: Screenplay,
  opening: TextBlock[],
): void {
  screenplay.opening = opening;
}
