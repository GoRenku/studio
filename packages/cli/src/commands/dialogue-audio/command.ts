import { createProjectDataService } from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { RenkuCliIo } from '../../cli.js';
import {
  dispatchCliCommand,
  writeJson,
  type CliCommandHandler,
  type CliCommandRuntime,
} from '../structured-command.js';
import { showDialogueAudio } from './show.js';
import { setupDialogueAudio } from './setup.js';

export interface DialogueAudioCommandFlags {
  project?: string;
  file?: string;
  scene?: string;
  dialogue?: string;
}

export type DialogueAudioCommandRuntime = CliCommandRuntime;
export type DialogueAudioCommandInput = Parameters<
  CliCommandHandler<DialogueAudioCommandFlags, DialogueAudioCommandRuntime>['run']
>[0];

const handlers = [
  { path: ['show'], run: showDialogueAudio },
  { path: ['setup'], run: setupDialogueAudio },
] satisfies CliCommandHandler<
  DialogueAudioCommandFlags,
  DialogueAudioCommandRuntime
>[];

export async function runDialogueAudioCommand(options: {
  input: string[];
  flags: DialogueAudioCommandFlags;
  json: boolean;
  io: RenkuCliIo;
  homeDir?: string;
}): Promise<number> {
  const runtime: DialogueAudioCommandRuntime = {
    projectName: options.flags.project,
    homeDir: options.homeDir,
    json: options.json,
    io: options.io,
    projectDataService: createProjectDataService(),
  };
  const result = await dispatchCliCommand({
    commandPath: options.input,
    flags: options.flags,
    runtime,
    handlers,
    unknownCommand: (commandPath) => new StructuredError({
      code: 'CLI155',
      message: `Unknown dialogue-audio command: ${commandPath.join(' ') || '(none)'}.`,
      suggestion: 'Use dialogue-audio show or dialogue-audio setup.',
    }),
  });
  writeJson(options.io, result);
  return 0;
}
