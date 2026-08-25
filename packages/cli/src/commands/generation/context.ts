import { parseGenerationPurpose, parseGenerationTarget } from '../media-purpose.js';
import { requiredFlag } from '../structured-command.js';
import type { GenerationCommandInput } from './command.js';

export async function showGenerationContext(input: GenerationCommandInput) {
  const purpose = parseGenerationPurpose(requiredFlag(input.flags.purpose, '--purpose'));
  const target = parseGenerationTarget({
    purpose,
    target: requiredFlag(input.flags.target, '--target'),
  });
  const beatIds = flagValues(input.flags.beat);
  return input.runtime.projectDataService.readMediaGenerationContext({
    projectName: input.runtime.projectName,
    homeDir: input.runtime.homeDir,
    purpose,
    target,
    ...(purpose === 'scene.storyboard-sheet'
      ? {
          sceneStoryboardScope: {
            ...(input.flags.revision
              ? { sceneBeatsRevisionId: input.flags.revision }
              : {}),
            beatIds,
          },
        }
      : {}),
  });
}

function flagValues(value: string | string[] | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
