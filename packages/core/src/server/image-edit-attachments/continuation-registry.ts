import type { AssetFile, AssetFileOwner } from '../../client/asset-files.js';
import type { ProjectAssetFileDestination } from '../project-asset-files/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { assetFileOwnerResourceKeys, shotPlanAssetFileResourceKeys } from '../asset-files/resource-keys.js';
import { resolveLookbookImageEditContinuation } from './lookbook-continuations.js';
import { resolveSceneImageEditContinuation } from './scene-continuations.js';
import { resolveShotPlanImageEditContinuation } from './shot-plan-continuations.js';
import { resolveSubjectImageEditContinuation } from './subject-continuations.js';

export interface ImageEditContinuation {
  owner: AssetFileOwner;
  assetFileType: string;
  destination: ProjectAssetFileDestination;
  authoredFromShotPlanId?: string;
  resourceKeys: string[];
}

export interface ImageEditContinuationInput {
  source: AssetFile;
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
  return {
    owner: input.source.owner,
    assetFileType: input.source.type,
    destination: { kind: 'assetFile.imageEdit', sourceAssetFileId: input.source.id },
    authoredFromShotPlanId: input.source.authoredFrom?.id,
    resourceKeys: [
      ...assetFileOwnerResourceKeys(input.session, input.source.owner),
      ...shotPlanAssetFileResourceKeys(input.session, input.source.id),
    ],
  };
}
