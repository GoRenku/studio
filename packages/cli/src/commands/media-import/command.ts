import { parseGenerationPurpose } from '../media-purpose.js';
import { requiredFlag, type CliCommandHandler } from '../structured-command.js';
import { importGenerationMedia } from './generic.js';
import { importSceneStoryboard } from './scene-storyboard.js';
import { importShotPlanDialogueAudio } from './shot-plan-dialogue-audio.js';

export interface MediaCommandFlags {
  project?: string;
  purpose?: string;
  target?: string;
  source?: string;
  title?: string;
  file?: string;
  summary?: string;
  referenceName?: string;
  tag?: string[];
  sections?: string;
  anchor?: string;
  provenance?: string;
  turns?: string;
  sourceSheet?: string;
  revision?: string;
  beats?: string;
  take?: string;
  kind?: string;
  select?: boolean;
  selection?: string;
  replaceSelected?: boolean;
}

export type MediaImportCommandInput = Parameters<
  CliCommandHandler<MediaCommandFlags>['run']
>[0];

export const mediaImportCommandHandler: CliCommandHandler<MediaCommandFlags> = {
  path: ['import'],
  async run(input) {
    const purpose = parseGenerationPurpose(
      requiredFlag(input.flags.purpose, '--purpose')
    );
    if (purpose === 'scene.storyboard-sheet') {
      return importSceneStoryboard({ ...input, purpose });
    }
    if (purpose === 'shot-plan.dialogue-audio') {
      return importShotPlanDialogueAudio({ ...input, purpose });
    }
    return importGenerationMedia({ ...input, purpose });
  },
};
