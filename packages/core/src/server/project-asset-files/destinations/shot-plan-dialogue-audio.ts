import type { ProjectRelativePath } from '../../../client/index.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import {
  allocateProjectAssetFileNames,
  allocateProjectAssetFilePath,
  allocateProjectAssetFilePathSync,
} from '../path-allocation.js';
import { requireShotPlanStorageContext } from './shot-plan.js';
import type {
  DestinationFileInput,
  DestinationOutputNamesInput,
  DestinationRootInput,
} from './types.js';

export async function resolveShotPlanDialogueAudioDestinationFile(
  input: DestinationFileInput<'shotPlan.dialogueAudio'>
): Promise<ProjectRelativePath> {
  return allocateProjectAssetFilePath({
    projectFolder: input.projectFolder,
    parent: await resolveShotPlanDialogueAudioDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: dialogueAudioFileStem(input.destination),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export function resolveShotPlanDialogueAudioDestinationFileSync(
  input: DestinationFileInput<'shotPlan.dialogueAudio'>
): ProjectRelativePath {
  return allocateProjectAssetFilePathSync({
    projectFolder: input.projectFolder,
    parent: resolveShotPlanDialogueAudioDestinationRootSync(input),
    namingMode: input.namingMode,
    generatedBaseName: dialogueAudioFileStem(input.destination),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
  });
}

export async function resolveShotPlanDialogueAudioDestinationRoot(
  input: DestinationRootInput<'shotPlan.dialogueAudio'>
): Promise<ProjectRelativePath> {
  return resolveShotPlanDialogueAudioDestinationRootSync(input);
}

export function resolveShotPlanDialogueAudioDestinationRootSync(
  input: DestinationRootInput<'shotPlan.dialogueAudio'>
): ProjectRelativePath {
  const shotPlan = requireShotPlanStorageContext(input.session, input.destination.shotPlanId);
  return joinProjectRelativePath(shotPlan.root, 'audio');
}

export async function resolveShotPlanDialogueAudioDestinationOutputNames(
  input: DestinationOutputNamesInput<'shotPlan.dialogueAudio'>
): Promise<string[]> {
  return allocateProjectAssetFileNames({
    projectFolder: input.projectFolder,
    parent: await resolveShotPlanDialogueAudioDestinationRoot(input),
    namingMode: input.namingMode,
    generatedBaseName: dialogueAudioFileStem(input.destination),
    sourceProjectRelativePath: input.sourceProjectRelativePath,
    outputFormatHint: input.outputFormatHint,
    count: input.outputCount,
  });
}

function dialogueAudioFileStem(input: { turnStartNumber: number; turnEndNumber: number }): string {
  const start = String(input.turnStartNumber).padStart(2, '0');
  const end = String(input.turnEndNumber).padStart(2, '0');
  return input.turnStartNumber === input.turnEndNumber
    ? `turn-${start}`
    : `turns-${start}-${end}`;
}
