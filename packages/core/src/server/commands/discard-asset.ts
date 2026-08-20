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
import { assertAssetIsNotScreenplayImportSource } from '../screenplay/fdx/persistence/import-record.js';
import { readSelectedAssetRecord } from '../database/access/selected-assets.js';
import { assetSelectionTargetKey } from '../assets/selection-targets.js';
import {
  projectCoverCandidateResourceKeys,
  projectCoverSelectionResourceKeys,
  studioTrashResourceKey,
} from '../studio-coordination/resource-keys.js';

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
    if (
      input.expectedType !== undefined
      && asset.type !== input.expectedType
    ) {
      throw new ProjectDataError(
        'CORE_ASSET_TYPE_MISMATCH',
        `Asset ${input.assetId} does not have the expected type ${input.expectedType}.`
      );
    }
    assertAssetIsNotCastVoiceSample(session, input.assetId);
    assertAssetIsNotScreenplayImportSource(session, input.assetId);
    const isProjectCover = owner.kind === 'project'
      && asset.type === 'project_cover';
    const isSelectedProjectCover = isProjectCover
      && readSelectedAssetRecord(
        session,
        assetSelectionTargetKey({ kind: 'project' })
      )?.assetId === asset.id;

    return discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'asset',
      itemId: input.assetId,
      commandName: 'asset.discard',
      changes: [{ type: 'asset.discarded', assetId: input.assetId }],
      resourceKeys: [
        ...(isSelectedProjectCover
          ? projectCoverSelectionResourceKeys()
          : isProjectCover
            ? projectCoverCandidateResourceKeys()
            : assetOwnerResourceKeys(session, owner)),
        ...shotPlanVideoAssetResourceKeys(session, input.assetId),
        ...(isProjectCover ? [studioTrashResourceKey()] : []),
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
