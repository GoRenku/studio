import type { DialogueTurnRange } from '../../client/shot-plan-dialogue-audio.js';
import { ProjectDataError } from '../project-data-error.js';

export function validateDialogueTurnRange(range: DialogueTurnRange): DialogueTurnRange {
  if (
    !Number.isInteger(range.start)
    || !Number.isInteger(range.end)
    || range.start < 1
    || range.end < range.start
  ) {
    throw new ProjectDataError(
      'CORE_SHOT_PLAN_DIALOGUE_AUDIO_TURN_RANGE_INVALID',
      'Dialogue turn range must contain positive integers in ascending order.'
    );
  }
  return { start: range.start, end: range.end };
}
