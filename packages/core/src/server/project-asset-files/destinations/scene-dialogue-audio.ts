import type { ProjectRelativePath } from '../../../client/index.js';
import { extensionForMediaSource, kebabCasePathSegment } from '../../files/asset-paths.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { readScreenplayDocumentFromSession } from '../../database/access/screenplay-resource.js';
import { ProjectDataError } from '../../project-data-error.js';
import { projectPathExistsSync } from '../file-operations.js';
import { requireSceneHierarchy } from '../owner-lookups.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

export async function resolveSceneDialogueAudioDestinationFile(
  input: DestinationFileInput<'scene.dialogueAudio'>
): Promise<ProjectRelativePath> {
  return resolveSceneDialogueAudioDestinationFileSync(input);
}

export function resolveSceneDialogueAudioDestinationFileSync(
  input: DestinationFileInput<'scene.dialogueAudio'>
): ProjectRelativePath {
  const root = resolveSceneDialogueAudioDestinationRootSync(input);
  const basePrefix = sceneDialogueAudioBasePrefix(input.session, input.destination);
  const extension = extensionForMediaSource(input.sourceProjectRelativePath);
  for (let index = 0; index < 100; index += 1) {
    const candidate = joinProjectRelativePath(
      root,
      `${basePrefix}-${String(index).padStart(2, '0')}${extension}`
    );
    if (!projectPathExistsSync(input.projectFolder, candidate)) {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_NAME_ALLOCATION_FAILED',
    `Could not allocate a dialogue audio file name for ${basePrefix}${extension}.`
  );
}

export async function resolveSceneDialogueAudioDestinationRoot(
  input: DestinationRootInput<'scene.dialogueAudio'>
): Promise<ProjectRelativePath> {
  return resolveSceneDialogueAudioDestinationRootSync(input);
}

export function resolveSceneDialogueAudioDestinationRootSync(
  input: DestinationRootInput<'scene.dialogueAudio'>
): ProjectRelativePath {
  const hierarchy = requireSceneHierarchy(input.session, input.destination.sceneId);
  return joinProjectRelativePath(
    'audio',
    kebabCasePathSegment(hierarchy.sequenceTitle, 'sequence'),
    kebabCasePathSegment(hierarchy.sceneTitle, 'scene')
  );
}

export async function resolveSceneDialogueAudioDestinationOutputNames(
  input: DestinationOutputNamesInput<'scene.dialogueAudio'>
): Promise<string[]> {
  const filePath = await resolveSceneDialogueAudioDestinationFile(input);
  return [filePath.split('/').at(-1)!];
}

function sceneDialogueAudioBasePrefix(
  session: DestinationRootInput<'scene.dialogueAudio'>['session'],
  destination: DestinationRootInput<'scene.dialogueAudio'>['destination']
): string {
  const screenplay = readScreenplayDocumentFromSession(session);
  if (!screenplay) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_OWNER_MISSING',
      'Scene Dialogue Audio storage requires a screenplay.'
    );
  }
  for (const act of screenplay.acts) {
    for (const sequence of act.sequences) {
      for (const scene of sequence.scenes) {
        if (scene.id !== destination.sceneId) {
          continue;
        }
        const block = scene.blocks.find(
          (candidate) =>
            candidate.type === 'dialogue' &&
            candidate.dialogueId === destination.dialogueId
        );
        if (!block || block.type !== 'dialogue') {
          throw new ProjectDataError(
            'PROJECT_ASSET_FILE_OWNER_MISSING',
            `Dialogue block was not found for project asset file destination: ${destination.dialogueId}.`
          );
        }
        if (!block.dialogueOrderKey) {
          throw new ProjectDataError(
            'PROJECT_ASSET_FILE_DIALOGUE_ORDER_KEY_MISSING',
            `Dialogue block is missing a stable dialogueOrderKey: ${destination.dialogueId}.`
          );
        }
        const castMember = block.castMemberId
          ? screenplay.cast.find((candidate) => candidate.id === block.castMemberId)
          : null;
        return `${block.dialogueOrderKey}-${kebabCasePathSegment(
          castMember?.handle || castMember?.name || 'dialogue',
          'dialogue'
        )}`;
      }
    }
  }
  throw new ProjectDataError(
    'PROJECT_ASSET_FILE_OWNER_MISSING',
    `Scene was not found for project asset file destination: ${destination.sceneId}.`
  );
}
