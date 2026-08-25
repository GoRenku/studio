import type { Asset, AssetOwner } from '../../client/assets.js';
import type { ProjectAssetFileDestination } from '../project-asset-files/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { resolveLookbookImageEditContinuation } from './lookbook-continuations.js';
import { resolveSceneImageEditContinuation } from './scene-continuations.js';
import { resolveShotPlanImageEditContinuation } from './shot-plan-continuations.js';
import { resolveSubjectImageEditContinuation } from './subject-continuations.js';

export interface ImageEditContinuation {
  owner: AssetOwner;
  assetType: string;
  destination: ProjectAssetFileDestination;
  fileRole: string;
  authoredFromShotPlanId?: string;
  resourceKeys: string[];
}

export interface ImageEditContinuationInput {
  source: Asset;
  session: DatabaseSession;
  projectFolder: string;
}

type ContinuationResolver = (
  input: ImageEditContinuationInput,
) => ImageEditContinuation | null;

const continuationResolvers: ContinuationResolver[] = [
  resolveSubjectImageEditContinuation,
  resolveLookbookImageEditContinuation,
  resolveSceneImageEditContinuation,
  resolveShotPlanImageEditContinuation,
];

export function resolveImageEditContinuation(
  input: ImageEditContinuationInput,
): ImageEditContinuation {
  for (const resolver of continuationResolvers) {
    const continuation = resolver(input);
    if (continuation) {
      return continuation;
    }
  }
  throw new ProjectDataError(
    'CORE_IMAGE_EDIT_CONTINUATION_UNSUPPORTED',
    `Image editing is not attached for Asset type ${input.source.type}.`,
  );
}
