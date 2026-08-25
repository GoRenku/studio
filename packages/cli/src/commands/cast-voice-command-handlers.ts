import {
  resolveRenkuProviderCredential,
  type CastVoiceAttachmentCommandDocument,
  type CreateCastVoiceProviderRegistrationInput,
} from '@gorenku/studio-core/server';
import { fetchElevenLabsVoiceSampleAudio } from '@gorenku/studio-engines';
import { StructuredError } from '@gorenku/studio-diagnostics';
import {
  readRequiredJsonInput,
} from './command-io.js';
import {
  requiredFlag,
  type CliCommandHandler,
  type CliCommandRuntime,
} from './structured-command.js';
import { throwEngineError } from './generation/engine-errors.js';

export interface CastVoiceCommandFlags {
  file?: string;
  project?: string;
  cast?: string;
  voice?: string;
  registration?: string;
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
  const document = await readRequiredJsonInput(
    filePath,
    'cast voice attach',
  ) as CastVoiceAttachmentCommandDocument;
  const elevenLabsVoiceSampleFetcher = document.kind === 'castVoiceElevenLabsSampleAttachment'
    ? await createElevenLabsVoiceSampleFetcher(input.runtime.homeDir)
    : undefined;
  return input.runtime.projectDataService.attachCastVoice({
    homeDir: input.runtime.homeDir,
    projectName: input.flags.project,
    document,
    ...(elevenLabsVoiceSampleFetcher ? { elevenLabsVoiceSampleFetcher } : {}),
  });
}

async function createElevenLabsVoiceSampleFetcher(homeDir?: string) {
  const credential = await resolveRenkuProviderCredential('elevenlabs', { homeDir });
  if (!credential) {
    throw new StructuredError({
      code: 'PROVIDER_CREDENTIALS004',
      message: 'ElevenLabs credentials are not configured.',
      suggestion: 'Configure ELEVENLABS_API_KEY in Renku Settings and try again.',
    });
  }
  return async ({ voiceId }: { voiceId: string }) => {
    try {
      return await fetchElevenLabsVoiceSampleAudio({ voiceId, credential });
    } catch (error) {
      throwEngineError(error);
    }
  };
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

type CastVoiceCommandInput = {
  flags: CastVoiceCommandFlags;
  runtime: CliCommandRuntime;
};
