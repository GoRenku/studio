import type { RecoverableMutationReport } from '../../client/index.js';
import { readAssetRecord } from '../database/access/assets.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { assertAssetIsNotCastVoiceSample } from './cast-voice-commands.js';
import { readProjectRecord } from '../database/access/project.js';
import { ProjectDataError } from '../project-data-error.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';
import { requireAssetOwner } from '../assets/ownership.js';
import { assetOwnerKey } from '../assets/owner-keys.js';
import { assetOwnerResourceKeys } from '../assets/resource-keys.js';
import type { DiscardAssetInput } from '../project-data-service-contracts.js';
import { shotPlanVideoAssetResourceKeys } from '../shot-plan-video-generations/source-provenance.js';

export async function discardAsset(
  input: DiscardAssetInput
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
    const asset = readAssetRecord(session, input.assetId);
    if (!asset || asset.discardedAt) {
      throw assetNotAttached(input.assetId);
    }
    const owner = requireAssetOwner(session, input.assetId);
    if (assetOwnerKey(owner) !== assetOwnerKey(input.owner)) {
      throw new ProjectDataError(
        'CORE_ASSET_OWNER_MISMATCH',
        `Asset ${input.assetId} is not owned by the requested owner.`
      );
    }
    assertAssetIsNotCastVoiceSample(session, input.assetId);

    return discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'asset',
      itemId: input.assetId,
      commandName: 'asset.discard',
      changes: [{ type: 'asset.discarded', assetId: input.assetId }],
      resourceKeys: [
        ...assetOwnerResourceKeys(session, owner),
        ...shotPlanVideoAssetResourceKeys(session, input.assetId),
      ],
    });
  } finally {
    session.close();
  }
}

function assetNotAttached(assetId: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA078',
    `Asset ${assetId} is not attached to the requested target.`
  );
}
