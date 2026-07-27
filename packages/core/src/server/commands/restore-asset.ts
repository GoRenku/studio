import type { RecoverableMutationReport } from '../../client/index.js';
import { readProjectRecord } from '../database/access/project.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RestoreAssetInput } from '../project-data-service-contracts.js';
import { restoreTrashObject } from '../trash/trash-lifecycle-service.js';

export async function restoreAsset(
  input: RestoreAssetInput
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
    return restoreTrashObject({
      session,
      project,
      projectFolder,
      itemKind: 'asset',
      itemId: input.assetId,
    });
  } finally {
    session.close();
  }
}
