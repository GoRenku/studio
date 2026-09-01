import { StructuredError } from '@gorenku/studio-diagnostics';
import type { MediaImportCommandInput } from './command.js';
import { importGenerationMedia } from './generic.js';

export function importShotPlanDialogueAudio(input: MediaImportCommandInput & {
  purpose: 'shot-plan.dialogue-audio';
}) {
  return importGenerationMedia({
    ...input,
    turnRange: parseDialogueTurnRange(input.flags.turns),
  });
}

export function parseDialogueTurnRange(value: string | undefined) {
  const match = value?.match(/^([1-9]\d*)(?:-([1-9]\d*))?$/);
  if (!match) {
    throw invalidDialogueTurnRange(value);
  }
  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) {
    throw invalidDialogueTurnRange(value);
  }
  return { start, end };
}

function invalidDialogueTurnRange(value: string | undefined): StructuredError {
  return new StructuredError({
    code: 'CLI164',
    message: `Dialogue turn range must be one positive number or one ascending range. Received: ${value ?? '(missing)'}.`,
    suggestion: 'Use --turns <N> or --turns <N-M>.',
  });
}
