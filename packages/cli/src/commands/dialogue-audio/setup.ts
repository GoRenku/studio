import { readJsonInput } from '../command-io.js';
import { appendStudioResourceChangedEvent } from '../studio-resource-event-command.js';
import { requiredFlag } from '../structured-command.js';
import type { DialogueAudioCommandInput } from './command.js';

export async function setupDialogueAudio(input: DialogueAudioCommandInput) {
  const sceneId = requiredFlag(input.flags.scene, '--scene');
  const turnId = requiredFlag(input.flags.dialogue, '--dialogue');
  const setup = await readJsonInput(requiredFlag(input.flags.file, '--file'));
  const project = await input.runtime.projectDataService.resolveStudioProjectRef({
    projectName: input.runtime.projectName,
    homeDir: input.runtime.homeDir,
  });
  const report = await input.runtime.projectDataService.replaceSceneDialogueAudioSetup({
    projectName: project.name,
    homeDir: input.runtime.homeDir,
    sceneId,
    turnId,
    setup,
  });
  await appendStudioResourceChangedEvent({
    runtime: {
      projectName: project.name,
      homeDir: input.runtime.homeDir,
      json: input.runtime.json,
      io: input.runtime.io,
      projectDataService: input.runtime.projectDataService,
    },
    report: {
      project: { projectName: project.name, id: project.id },
      resourceKeys: report.resourceKeys,
    },
    command: 'renku dialogue-audio setup',
  });
  return report;
}
