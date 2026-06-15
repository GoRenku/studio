import type {
  CastVoiceAttachmentCommandDocument,
  CreateCastVoiceProviderRegistrationInput,
  KlingVoiceRegistrationSpec,
} from '@gorenku/studio-core/server';
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
  registration?: string;
  approvalToken?: string;
  simulate?: boolean;
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
  {
    path: ['registrations', 'list'],
    run: runRegistrationList,
  },
  {
    path: ['registrations', 'show'],
    run: runRegistrationShow,
  },
  {
    path: ['registrations', 'create'],
    run: runRegistrationCreate,
  },
  {
    path: ['registrations', 'remove'],
    run: runRegistrationRemove,
  },
  {
    path: ['kling-registration', 'estimate'],
    run: runKlingRegistrationEstimate,
  },
  {
    path: ['kling-registration', 'run'],
    run: runKlingRegistrationRun,
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

async function runRegistrationList(input: CastVoiceCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.listCastVoiceProviderRegistrations({
    homeDir: input.runtime.homeDir,
    projectName: input.flags.project,
    castMemberId: requiredFlag(input.flags.cast, '--cast'),
    voiceIdOrName: requiredFlag(input.flags.voice, '--voice'),
  });
}

async function runRegistrationShow(input: CastVoiceCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.readCastVoiceProviderRegistration({
    homeDir: input.runtime.homeDir,
    projectName: input.flags.project,
    castMemberId: requiredFlag(input.flags.cast, '--cast'),
    voiceIdOrName: requiredFlag(input.flags.voice, '--voice'),
    registrationId: requiredFlag(input.flags.registration, '--registration'),
  });
}

async function runRegistrationCreate(input: CastVoiceCommandInput): Promise<unknown> {
  const filePath = requiredFlag(input.flags.file, '--file');
  const document = (await readRequiredJsonInput(
    filePath,
    'cast voice registrations create'
  )) as CreateCastVoiceProviderRegistrationInput['registration'];
  return input.runtime.projectDataService.createCastVoiceProviderRegistration({
    homeDir: input.runtime.homeDir,
    projectName: input.flags.project,
    castMemberId: requiredFlag(input.flags.cast, '--cast'),
    voiceIdOrName: requiredFlag(input.flags.voice, '--voice'),
    registration: document,
  });
}

async function runRegistrationRemove(input: CastVoiceCommandInput): Promise<unknown> {
  return input.runtime.projectDataService.removeCastVoiceProviderRegistration({
    homeDir: input.runtime.homeDir,
    projectName: input.flags.project,
    castMemberId: requiredFlag(input.flags.cast, '--cast'),
    voiceIdOrName: requiredFlag(input.flags.voice, '--voice'),
    registrationId: requiredFlag(input.flags.registration, '--registration'),
  });
}

async function runKlingRegistrationEstimate(input: CastVoiceCommandInput): Promise<unknown> {
  const filePath = requiredFlag(input.flags.file, '--file');
  const spec = (await readRequiredJsonInput(
    filePath,
    'cast voice kling-registration estimate'
  )) as KlingVoiceRegistrationSpec;
  return input.runtime.projectDataService.estimateKlingCastVoiceRegistration({
    homeDir: input.runtime.homeDir,
    projectName: input.flags.project,
    spec,
  });
}

async function runKlingRegistrationRun(input: CastVoiceCommandInput): Promise<unknown> {
  const filePath = requiredFlag(input.flags.file, '--file');
  const spec = (await readRequiredJsonInput(
    filePath,
    'cast voice kling-registration run'
  )) as KlingVoiceRegistrationSpec;
  return input.runtime.projectDataService.runKlingCastVoiceRegistration({
    homeDir: input.runtime.homeDir,
    projectName: input.flags.project,
    spec,
    approvalToken: input.flags.approvalToken,
    simulate: input.flags.simulate,
  });
}

type CastVoiceCommandInput = {
  flags: CastVoiceCommandFlags;
  runtime: CliCommandRuntime;
};
