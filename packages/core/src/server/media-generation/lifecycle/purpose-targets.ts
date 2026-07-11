import type { MediaGenerationRequestTarget } from '../../../client/index.js';
import type {
  CastMediaGenerationContextInput,
  LocationMediaGenerationContextInput,
  ReadLookbookImageGenerationContextInput,
  ReadSceneStoryboardSheetGenerationContextInput,
  ShotVideoTakeContextInput,
  ShotVideoTakeModelListInput,
} from '../../project-data-service-contracts.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { ImageCreateTargetInput } from '../purposes/image-create.js';
import type { ImageEditTargetInput } from '../purposes/image-edit.js';
import type { LocationHeroTargetInput } from '../purposes/location-hero.js';
import type {
  ListMediaGenerationSpecsInput,
  MediaGenerationPurposeContextInput,
} from './purpose-definition.js';

type TargetInput =
  | MediaGenerationPurposeContextInput
  | ListMediaGenerationSpecsInput;

export function requireTargetKind<
  T extends MediaGenerationRequestTarget['kind'],
>(
  input: TargetInput,
  kind: T,
): Extract<MediaGenerationRequestTarget, { kind: T }> {
  if (input.target.kind !== kind) {
    throw new ProjectDataError(
      'PROJECT_DATA388',
      `Media generation purpose ${input.purpose} requires target.kind "${kind}". Received: ${input.target.kind}.`,
    );
  }
  return input.target as Extract<MediaGenerationRequestTarget, { kind: T }>;
}

export function toProjectInput(input: TargetInput): ImageCreateTargetInput {
  const target = requireTargetKind(input, 'project');
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    ...(target.id ? { projectId: target.id } : {}),
  };
}

export function toAssetInput(input: TargetInput): ImageEditTargetInput {
  const target = requireTargetKind(input, 'asset');
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    assetId: target.id,
  };
}

export function toLookbookInput(
  input: TargetInput,
): ReadLookbookImageGenerationContextInput {
  const target = requireTargetKind(input, 'lookbook');
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    lookbookId: target.id,
  };
}

export function toCastInput(
  input: TargetInput,
): CastMediaGenerationContextInput {
  const target = requireTargetKind(input, 'castMember');
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    castMemberId: target.id,
  };
}

export function toLocationInput(
  input: TargetInput,
): LocationMediaGenerationContextInput {
  const target = requireTargetKind(input, 'location');
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    locationId: target.id,
  };
}

export function toLocationHeroInput(
  input: TargetInput,
): LocationHeroTargetInput {
  return toLocationInput(input);
}

export function toSceneInput(
  input: TargetInput,
): ReadSceneStoryboardSheetGenerationContextInput {
  const target = requireTargetKind(input, 'scene');
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: target.id,
    shotListId: requireShotListId(input),
  };
}

export function toShotInput(input: TargetInput): ShotVideoTakeContextInput {
  const target = requireTargetKind(input, 'sceneShotVideoTake');
  return {
    projectName: input.projectName,
    homeDir: input.homeDir,
    sceneId: target.sceneId,
    takeId: target.takeId,
  };
}

export function toShotModelInput(
  input: MediaGenerationPurposeContextInput,
): ShotVideoTakeModelListInput {
  return {
    ...toShotInput(input),
    ...(input.inputModeId ? { inputModeId: input.inputModeId as never } : {}),
  };
}

function requireShotListId(input: TargetInput): string {
  if (!input.shotListId) {
    throw new ProjectDataError(
      'PROJECT_DATA389',
      `Media generation purpose ${input.purpose} requires shotListId.`,
    );
  }
  return input.shotListId;
}
