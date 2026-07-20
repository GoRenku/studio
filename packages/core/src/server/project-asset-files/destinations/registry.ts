import type { ProjectRelativePath } from '../../../client/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { ProjectAssetFileDestination, ProjectMediaKind } from '../types.js';
import {
  resolveCastDestinationFile,
  resolveCastDestinationFileSync,
  resolveCastDestinationOutputNames,
  resolveCastDestinationRoot,
  resolveCastDestinationRootSync,
} from './cast.js';
import {
  resolveLocationDestinationFile,
  resolveLocationDestinationFileSync,
  resolveLocationDestinationOutputNames,
  resolveLocationDestinationRoot,
  resolveLocationDestinationRootSync,
} from './location.js';
import {
  resolveLookbookDestinationFile,
  resolveLookbookDestinationFileSync,
  resolveLookbookDestinationOutputNames,
  resolveLookbookDestinationRoot,
  resolveLookbookDestinationRootSync,
} from './lookbook.js';
import {
  resolveSceneDialogueAudioDestinationFile,
  resolveSceneDialogueAudioDestinationFileSync,
  resolveSceneDialogueAudioDestinationOutputNames,
  resolveSceneDialogueAudioDestinationRoot,
  resolveSceneDialogueAudioDestinationRootSync,
} from './scene-dialogue-audio.js';
import type {
  DestinationKind,
  DestinationResolver,
  DestinationResolverRegistry,
} from './types.js';

const castCharacterSheetResolver = castResolver<'cast.characterSheet'>();
const castProfileResolver = castResolver<'cast.profile'>();
const castVoiceSampleResolver = castResolver<'cast.voiceSample'>();
const locationSheetResolver = locationResolver<'location.sheet'>();
const locationHeroResolver = locationResolver<'location.hero'>();
const lookbookImageResolver = lookbookResolver<'visualLanguage.lookbookImage'>();
const lookbookSheetResolver = lookbookResolver<'visualLanguage.lookbookSheet'>();

const destinationResolvers = {
  'cast.characterSheet': castCharacterSheetResolver,
  'cast.profile': castProfileResolver,
  'cast.voiceSample': castVoiceSampleResolver,
  'location.sheet': locationSheetResolver,
  'location.hero': locationHeroResolver,
  'visualLanguage.lookbookImage': lookbookImageResolver,
  'visualLanguage.lookbookSheet': lookbookSheetResolver,
  'scene.dialogueAudio': {
    resolveFile: resolveSceneDialogueAudioDestinationFile,
    resolveFileSync: resolveSceneDialogueAudioDestinationFileSync,
    resolveRoot: resolveSceneDialogueAudioDestinationRoot,
    resolveRootSync: resolveSceneDialogueAudioDestinationRootSync,
    resolveOutputNames: resolveSceneDialogueAudioDestinationOutputNames,
  },
} satisfies DestinationResolverRegistry;

export async function resolveDurableDestinationFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  destination: ProjectAssetFileDestination;
  sourceProjectRelativePath: ProjectRelativePath;
  mediaKind: ProjectMediaKind;
  now: string;
}): Promise<ProjectRelativePath> {
  return resolverFor(input.destination).resolveFile(input as never);
}

export function resolveDurableDestinationFileSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  destination: ProjectAssetFileDestination;
  sourceProjectRelativePath: ProjectRelativePath;
  mediaKind: ProjectMediaKind;
  now: string;
}): ProjectRelativePath {
  return resolverFor(input.destination).resolveFileSync(input as never);
}

export async function resolveDurableDestinationRoot(input: {
  session: DatabaseSession;
  projectFolder: string;
  destination: ProjectAssetFileDestination;
  sourceProjectRelativePath?: ProjectRelativePath;
  now: string;
}): Promise<ProjectRelativePath> {
  return resolverFor(input.destination).resolveRoot(input as never);
}

export function resolveDurableDestinationRootSync(input: {
  session: DatabaseSession;
  projectFolder: string;
  destination: ProjectAssetFileDestination;
  sourceProjectRelativePath?: ProjectRelativePath;
  now: string;
}): ProjectRelativePath {
  return resolverFor(input.destination).resolveRootSync(input as never);
}

export async function resolveDurableDestinationOutputNames(input: {
  session: DatabaseSession;
  projectFolder: string;
  destination: ProjectAssetFileDestination;
  sourceProjectRelativePath: ProjectRelativePath;
  mediaKind: ProjectMediaKind;
  outputCount: number;
  now: string;
  outputFormatHint?: string;
}): Promise<string[]> {
  return resolverFor(input.destination).resolveOutputNames(input as never);
}

function castResolver<K extends 'cast.characterSheet' | 'cast.profile' | 'cast.voiceSample'>(): DestinationResolver<K> {
  return {
    resolveFile: resolveCastDestinationFile,
    resolveFileSync: resolveCastDestinationFileSync,
    resolveRoot: resolveCastDestinationRoot,
    resolveRootSync: resolveCastDestinationRootSync,
    resolveOutputNames: resolveCastDestinationOutputNames,
  } as unknown as DestinationResolver<K>;
}

function locationResolver<K extends 'location.sheet' | 'location.hero'>(): DestinationResolver<K> {
  return {
    resolveFile: resolveLocationDestinationFile,
    resolveFileSync: resolveLocationDestinationFileSync,
    resolveRoot: resolveLocationDestinationRoot,
    resolveRootSync: resolveLocationDestinationRootSync,
    resolveOutputNames: resolveLocationDestinationOutputNames,
  } as unknown as DestinationResolver<K>;
}

function lookbookResolver<K extends 'visualLanguage.lookbookImage' | 'visualLanguage.lookbookSheet'>(): DestinationResolver<K> {
  return {
    resolveFile: resolveLookbookDestinationFile,
    resolveFileSync: resolveLookbookDestinationFileSync,
    resolveRoot: resolveLookbookDestinationRoot,
    resolveRootSync: resolveLookbookDestinationRootSync,
    resolveOutputNames: resolveLookbookDestinationOutputNames,
  } as unknown as DestinationResolver<K>;
}

function resolverFor<K extends DestinationKind>(
  destination: Extract<ProjectAssetFileDestination, { kind: K }>
): DestinationResolver<K> {
  const resolver = destinationResolvers[destination.kind];
  if (!resolver) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_UNSUPPORTED_DESTINATION',
      `Unsupported project asset file destination: ${JSON.stringify(destination)}.`
    );
  }
  return resolver as unknown as DestinationResolver<K>;
}
