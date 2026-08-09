import type { ProjectRelativePath } from '../../../client/index.js';
import { readCastMemberRecord } from '../../database/access/cast-members.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import { readCanonicalScreenplay } from '../../screenplay/projections/screenplay.js';
import { listSceneDialogueTurns } from '../../scene-dialogue-audio-workspace/turns.js';
import { requiredSemanticFileStem } from '../naming/safe-segments.js';
import { requireSceneStorageContext } from '../owner-lookups.js';
import {
  allocateProjectAssetFileNames,
  allocateProjectAssetFilePath,
  allocateProjectAssetFilePathSync,
} from '../path-allocation.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

export function assertSceneDialogueAudioDestinationReady(input: {
  session: DestinationRootInput<'scene.dialogueAudio'>['session'];
  sceneId: string;
  turnId: string;
}): void {
  requireSceneStorageContext(input.session, input.sceneId);
  sceneDialogueAudioFileStem(input.session, input);
}

export async function resolveSceneDialogueAudioDestinationFile(
  input: DestinationFileInput<'scene.dialogueAudio'>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveSceneDialogueAudioDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: sceneDialogueAudioFileStem(input.session, input.destination),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export function resolveSceneDialogueAudioDestinationFileSync(
  input: DestinationFileInput<'scene.dialogueAudio'>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveSceneDialogueAudioDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: sceneDialogueAudioFileStem(input.session, input.destination),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export async function resolveSceneDialogueAudioDestinationRoot(
  input: DestinationRootInput<'scene.dialogueAudio'>
): Promise<ProjectRelativePath> {
  return resolveSceneDialogueAudioDestinationRootSync(input);
}

export function resolveSceneDialogueAudioDestinationRootSync(
  input: DestinationRootInput<'scene.dialogueAudio'>
): ProjectRelativePath {
  const scene = requireSceneStorageContext(input.session, input.destination.sceneId);
  return joinProjectRelativePath('scenes', scene.pathSegment, 'dialogues');
}

export async function resolveSceneDialogueAudioDestinationOutputNames(
  input: DestinationOutputNamesInput<'scene.dialogueAudio'>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveSceneDialogueAudioDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: sceneDialogueAudioFileStem(input.session, input.destination),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
  });
}

function sceneDialogueAudioFileStem(
  session: DestinationRootInput<'scene.dialogueAudio'>['session'],
  destination: Pick<
    DestinationRootInput<'scene.dialogueAudio'>['destination'],
    'sceneId' | 'turnId'
  >
): string {
  const screenplay = readCanonicalScreenplay(session);
  const turns = listSceneDialogueTurns(screenplay, destination.sceneId);
  const turnIndex = turns.findIndex((candidate) => candidate.turn.id === destination.turnId);
  const context = turns[turnIndex];
  if (!context) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      `Dialogue Turn was not found for Scene ${destination.sceneId}: ${destination.turnId}.`
    );
  }
  if (!context.castMemberId) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_SPEAKER_REQUIRED',
      `Dialogue Turn has no speaker reference: ${destination.turnId}.`
    );
  }
  const castMember = readCastMemberRecord(session, context.castMemberId);
  if (!castMember) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_SPEAKER_REQUIRED',
      `Dialogue Turn speaker was not found: ${context.castMemberId}.`
    );
  }
  const scene = requireSceneStorageContext(session, destination.sceneId);
  return requiredSemanticFileStem(
    `s${scene.pathSegment}-${castMember.handle}-d${String(turnIndex + 1).padStart(2, '0')}`
  );
}
