import type { AssetTarget, RecoverableMutationReport } from '../../client/index.js';
import {
  readAssetRelationship,
} from '../database/access/asset-relationships/index.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { assertAssetIsNotCastVoiceSample } from './cast-voice-commands.js';
import { readProjectRecord } from '../database/access/project.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';
import { assetRelationshipTrashItemId } from '../trash/trash-object-registry.js';
import { countActiveSceneShotReferenceAssetOwners } from '../database/access/scene-shot-reference-assets.js';
import { countActiveSceneShotVideoTakeMediaOwners } from '../database/access/shot-video-take-media.js';

export async function discardAsset(
  input: {
    projectName: string;
    target: AssetTarget;
    assetId: string;
  } & RenkuConfigPathOptions
): Promise<RecoverableMutationReport> {
  const { projectFolder, session } = await openProjectSession(input);
  try {
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError(
        'PROJECT_DATA021',
        `Project database has no project row: ${session.databasePath}.`
      );
    }
    assertAssetNotReferencedByTakeMedia(session, input.assetId);
    const asset = readAssetRelationship(session, {
      target: input.target,
      assetId: input.assetId,
    });
    if (!asset) {
      throw assetNotAttached(input.assetId);
    }
    assertAssetIsNotCastVoiceSample(session, input.assetId);

    return discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'assetRelationship',
      itemId: assetRelationshipTrashItemId({
        target: input.target,
        assetId: input.assetId,
      }),
      commandName: 'assetRelationship.discard',
      changes: [{ type: 'assetRelationship.discarded', assetId: input.assetId }],
    });
  } finally {
    session.close();
  }
}

function assertAssetNotReferencedByTakeMedia(
  session: Awaited<ReturnType<typeof openProjectSession>>['session'],
  assetId: string
): void {
  const ownerCount = countActiveSceneShotReferenceAssetOwners(session, assetId) +
    countActiveSceneShotVideoTakeMediaOwners(session, assetId);
  if (ownerCount > 0) {
    throw new ProjectDataError(
      'PROJECT_DATA429',
      `Asset ${assetId} is referenced by active Shot take media.`
    );
  }
}

function assetNotAttached(assetId: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA078',
    `Asset ${assetId} is not attached to the requested target.`
  );
}
