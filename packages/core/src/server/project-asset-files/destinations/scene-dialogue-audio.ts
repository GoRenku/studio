import type { ProjectRelativePath } from '../../../client/index.js';
import { readCastMemberRecord } from '../../database/access/cast-members.js';
import { extensionForMediaSource, kebabCasePathSegment } from '../../files/asset-paths.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import { readCanonicalScreenplay } from '../../screenplay/projections/screenplay.js';
import { requireSceneDialogueTurn } from '../../scene-dialogue-audio-workspace/turns.js';
import { projectPathExistsSync } from '../file-operations.js';
import { requireSceneStorageContext } from '../owner-lookups.js';
import type { DestinationFileInput, DestinationOutputNamesInput, DestinationRootInput } from './types.js';

export function assertSceneDialogueAudioDestinationReady(input: {
  session: DestinationRootInput<'scene.dialogueAudio'>['session'];
  sceneId: string;
  turnId: string;
}): void {
  requireSceneStorageContext(input.session, input.sceneId);
  sceneDialogueAudioBasePrefix(input.session, input);
}

export async function resolveSceneDialogueAudioDestinationFile(
  input: DestinationFileInput<'scene.dialogueAudio'>,
): Promise<ProjectRelativePath> {
  return resolveSceneDialogueAudioDestinationFileSync(input);
}

export function resolveSceneDialogueAudioDestinationFileSync(
  input: DestinationFileInput<'scene.dialogueAudio'>,
): ProjectRelativePath {
  const root = resolveSceneDialogueAudioDestinationRootSync(input);
  const basePrefix = sceneDialogueAudioBasePrefix(input.session, input.destination);
  const extension = extensionForMediaSource(input.sourceProjectRelativePath);
  for (let index = 0; index < 100; index += 1) {
    const candidate = joinProjectRelativePath(root, `${basePrefix}-${String(index).padStart(2, '0')}${extension}`);
    if (!projectPathExistsSync(input.projectFolder, candidate)) {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_NAME_ALLOCATION_FAILED',
    `Could not allocate a dialogue audio file name for ${basePrefix}${extension}.`,
  );
}

export async function resolveSceneDialogueAudioDestinationRoot(
  input: DestinationRootInput<'scene.dialogueAudio'>,
): Promise<ProjectRelativePath> {
  return resolveSceneDialogueAudioDestinationRootSync(input);
}

export function resolveSceneDialogueAudioDestinationRootSync(
  input: DestinationRootInput<'scene.dialogueAudio'>,
): ProjectRelativePath {
  const scene = requireSceneStorageContext(input.session, input.destination.sceneId);
  return joinProjectRelativePath('audio', kebabCasePathSegment(scene.sceneId, 'scene'));
}

export async function resolveSceneDialogueAudioDestinationOutputNames(
  input: DestinationOutputNamesInput<'scene.dialogueAudio'>,
): Promise<string[]> {
  const filePath = await resolveSceneDialogueAudioDestinationFile(input);
  return [filePath.split('/').at(-1)!];
}

function sceneDialogueAudioBasePrefix(
  session: DestinationRootInput<'scene.dialogueAudio'>['session'],
  destination: Pick<DestinationRootInput<'scene.dialogueAudio'>['destination'], 'sceneId' | 'turnId'>,
): string {
  const screenplay = readCanonicalScreenplay(session);
  const context = requireSceneDialogueTurn(screenplay, destination.sceneId, destination.turnId);
  if (!context.castMemberId) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_SPEAKER_REQUIRED',
      `Dialogue Turn has no speaker reference: ${destination.turnId}.`,
    );
  }
  const castMember = readCastMemberRecord(session, context.castMemberId);
  if (!castMember) {
    throw new ProjectDataError(
      'CORE_DIALOGUE_AUDIO_SPEAKER_REQUIRED',
      `Dialogue Turn speaker was not found: ${context.castMemberId}.`,
    );
  }
  return `${kebabCasePathSegment(destination.turnId, 'turn')}-${kebabCasePathSegment(castMember.handle, 'speaker')}`;
}
