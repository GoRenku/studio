import type { RecoverableMutationReport } from '../../client/index.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { assertAssetFileIsNotCastVoiceSample } from '../cast-voices/lifecycle.js';
import { readProjectRecord } from '../database/access/project.js';
import { ProjectDataError } from '../project-data-error.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';
import { requireAssetFileOwner } from '../asset-files/ownership.js';
import { assetFileOwnerKey } from '../asset-files/owner-keys.js';
import { assetFileOwnerResourceKeys, shotPlanAssetFileResourceKeys } from '../asset-files/resource-keys.js';
import type { DiscardAssetFileInput } from '../project-data-service-contracts.js';
import { shotPlanVideoAssetFileResourceKeys } from '../shot-plan-video-generations/source-provenance.js';
import { assertAssetFileIsNotScreenplayImportSource } from '../screenplay/fdx/persistence/import-record.js';
import { assertAssetFileIsNotShotPlanDialogueAudioTake } from '../shot-plan-dialogue-audio/lifecycle.js';
import { readSelectedAssetFileRecord } from '../database/access/selected-asset-files.js';
import { assetFileSelectionTargetKey } from '../asset-files/selection-targets.js';
import {
  projectCoverCandidateResourceKeys,
  projectCoverSelectionResourceKeys,
  studioTrashResourceKey,
} from '../studio-coordination/resource-keys.js';

export async function discardAssetFile(
  input: DiscardAssetFileInput
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
    const assetFile = readAssetFileRecordIncludingDiscarded(session, input.assetFileId);
    if (!assetFile || assetFile.discardedAt) {
      throw assetFileNotAttached(input.assetFileId);
    }
    const owner = requireAssetFileOwner(session, input.assetFileId);
    if (assetFileOwnerKey(owner) !== assetFileOwnerKey(input.owner)) {
      throw new ProjectDataError(
        'CORE_ASSET_OWNER_MISMATCH',
        `Asset ${input.assetFileId} is not owned by the requested owner.`
      );
    }
    if (
      input.expectedType !== undefined
      && assetFile.type !== input.expectedType
    ) {
      throw new ProjectDataError(
        'CORE_ASSET_TYPE_MISMATCH',
        `Asset ${input.assetFileId} does not have the expected type ${input.expectedType}.`
      );
    }
    assertAssetFileIsNotCastVoiceSample(session, input.assetFileId);
    assertAssetFileIsNotScreenplayImportSource(session, input.assetFileId);
    assertAssetFileIsNotShotPlanDialogueAudioTake(session, input.assetFileId);
    const isProjectCover = owner.kind === 'project'
      && assetFile.type === 'project_cover';
    const isSelectedProjectCover = isProjectCover
      && readSelectedAssetFileRecord(
        session,
        assetFileSelectionTargetKey({ kind: 'project' })
      )?.assetFileId === assetFile.id;

    return discardTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'assetFile',
      itemId: input.assetFileId,
      commandName: 'asset.discard',
      changes: [{ type: 'asset.discarded', assetFileId: input.assetFileId }],
      resourceKeys: [
        ...(isSelectedProjectCover
          ? projectCoverSelectionResourceKeys()
          : isProjectCover
            ? projectCoverCandidateResourceKeys()
            : assetFileOwnerResourceKeys(session, owner)),
        ...shotPlanVideoAssetFileResourceKeys(session, input.assetFileId),
        ...shotPlanAssetFileResourceKeys(session, input.assetFileId),
        ...(isProjectCover ? [studioTrashResourceKey()] : []),
      ],
    });
  } finally {
    session.close();
  }
}

function assetFileNotAttached(assetFileId: string): ProjectDataError {
  return new ProjectDataError(
    'PROJECT_DATA078',
    `Asset ${assetFileId} is not attached to the requested target.`
  );
}
