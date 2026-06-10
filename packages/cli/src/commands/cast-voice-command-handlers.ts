import type { CastVoiceAttachmentCommandDocument } from '@gorenku/studio-core/server';
import {
  readRequiredJsonInput,
} from './department-command-io.js';
import {
  requiredFlag,
  type CliCommandHandler,
  type CliCommandRuntime,
} from './structured-command.js';

export interface CastVoiceCommandFlags {
  file?: string;
  project?: string;
  cast?: string;
  voice?: string;
}

export const castVoiceCommandHandlers = [
  {
    path: ['list'],
    run: runList,
  },
  {
    path: ['show'],
    run: runShow,
  },
  {
    path: ['validate'],
    run: runValidate,
  },
  {
    path: ['attach'],
    run: runAttach,
  },
  {
    path: ['remove'],
    run: runRemove,
  },
] satisfies CliCommandHandler<CastVoiceCommandFlags>[];

async function runList(input: CastVoiceCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.listCastVoices({
    homeDir: input.runtime.homeDir,
    projectName: input.flags.project,
    castMemberId: requiredFlag(input.flags.cast, '--cast'),
  });
}

async function runShow(input: CastVoiceCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.readCastVoice({
    homeDir: input.runtime.homeDir,
    projectName: input.flags.project,
    castMemberId: requiredFlag(input.flags.cast, '--cast'),
    voiceIdOrName: requiredFlag(input.flags.voice, '--voice'),
  });
}

async function runValidate(input: CastVoiceCommandInput): Promise<unknown> {
  const filePath = requiredFlag(input.flags.file, '--file');
  const document = await readRequiredJsonInput(filePath, 'cast voice validate');
  return input.runtime.projectDataService.validateCastVoiceAttachment({
    homeDir: input.runtime.homeDir,
    projectName: input.flags.project,
    document: document as CastVoiceAttachmentCommandDocument,
  });
}

async function runAttach(input: CastVoiceCommandInput): Promise<unknown> {
  const filePath = requiredFlag(input.flags.file, '--file');
  const document = await readRequiredJsonInput(filePath, 'cast voice attach');
  return input.runtime.projectDataService.attachCastVoice({
    homeDir: input.runtime.homeDir,
    projectName: input.flags.project,
    document: document as CastVoiceAttachmentCommandDocument,
  });
}

async function runRemove(input: CastVoiceCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.removeCastVoice({
    homeDir: input.runtime.homeDir,
    projectName: input.flags.project,
    castMemberId: requiredFlag(input.flags.cast, '--cast'),
    voiceIdOrName: requiredFlag(input.flags.voice, '--voice'),
  });
}

type CastVoiceCommandInput = {
  flags: CastVoiceCommandFlags;
  runtime: CliCommandRuntime;
};
