import type {
  ShotVideoTakeInputKind,
  ShotVideoTakeOwnedMediaRepairReport,
  ShotVideoTakePreparedInput,
} from '../../../../../client/index.js';
import {
  listActiveShotVideoTakeInputAssetRecords,
  updateShotVideoTakeInputAssetRecord,
  type ActiveShotVideoTakeInputAssetRecord,
} from '../../../../database/access/shot-video-takes.js';
import {
  updateSceneShotVideoTakeProductionRecord,
} from '../../../../database/access/scene-shot-video-takes.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
} from '../../../../entity-ids.js';
import type {
  RepairShotVideoTakeOwnedMediaInput,
} from '../../../../project-data-service-contracts.js';
import {
  requireScreenplayDocument,
  withShotProjectSession,
} from '../shared/project-session.js';
import {
  requireSceneShotVideoTake,
} from '../../../../database/access/scene-shot-video-takes.js';
import {
  copyTakeOwnedMediaAssetFile,
  isShotVideoTakeOwnedMediaAsset,
} from './take-owned-media.js';
import {
  resolveShotVideoTakeFolder,
} from '../shared/take-media-paths.js';

interface ActiveTakeOwnedInputRow extends ActiveShotVideoTakeInputAssetRecord {
  inputKind: ShotVideoTakeInputKind;
}

export async function repairShotVideoTakeOwnedMedia(
  input: RepairShotVideoTakeOwnedMediaInput
): Promise<ShotVideoTakeOwnedMediaRepairReport> {
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const now = new Date().toISOString();
    const ids = createUniqueIdAllocator(
      input.idGenerator ?? createRandomIdGenerator()
    );
    const screenplay = requireScreenplayDocument(session);
    const rows = listActiveTakeOwnedInputRows(session);
    const repairedInputs: ShotVideoTakeOwnedMediaRepairReport['repairedInputs'] = [];

    for (const row of inputRowsToRepair(rows)) {
        const targetTake = requireSceneShotVideoTake(session, {
          takeId: row.takeId,
          screenplay,
        });
        const copied = copyTakeOwnedMediaAssetFile({
          session,
          projectFolder,
          sourceAssetId: row.assetId,
          sourceAssetFileId: row.assetFileId,
          targetTakeId: row.takeId,
          targetTakeFolder: resolveShotVideoTakeFolder({
            session,
            screenplay,
            take: targetTake,
          }),
          inputKind: row.inputKind,
          allowDiscardedSource:
            Boolean(row.assetDiscardedAt) || Boolean(row.assetFileDiscardedAt),
          now,
          nextId: ids,
        });
        updateShotVideoTakeInputAssetRecord(session, {
          inputId: row.inputId,
          assetId: copied.assetId,
          assetFileId: copied.assetFileId,
          now,
        });
        const preparedInputs = repairedPreparedInputs({
          preparedInputs: targetTake.state.production.preparedInputs,
          row,
          assetId: copied.assetId,
          assetFileId: copied.assetFileId,
        });
        if (preparedInputs !== targetTake.state.production.preparedInputs) {
          updateSceneShotVideoTakeProductionRecord(session, {
            takeId: row.takeId,
            production: {
              ...targetTake.state.production,
              preparedInputs,
            },
            screenplay,
            now,
          });
        }
        repairedInputs.push({
          inputId: row.inputId,
          takeId: row.takeId,
          inputKind: row.inputKind,
          sourceAssetId: row.assetId,
          sourceAssetFileId: row.assetFileId,
          assetId: copied.assetId,
          assetFileId: copied.assetFileId,
          projectRelativePath: copied.projectRelativePath,
        });
    }

    return {
      project: {
        id: project.id,
        name: project.name,
        projectFolder,
      },
      repairedInputs,
      resourceKeys: repairResourceKeys(repairedInputs),
    };
  });
}

function inputRowsToRepair(
  rows: ActiveTakeOwnedInputRow[]
): ActiveTakeOwnedInputRow[] {
  const repairByInputId = new Map<string, ActiveTakeOwnedInputRow>();
  for (const row of rows) {
    if (row.assetDiscardedAt || row.assetFileDiscardedAt) {
      repairByInputId.set(row.inputId, row);
    }
  }
  for (const component of sharedInputComponents(rows)) {
    const keep = component[0];
    if (!keep) {
      continue;
    }
    for (const row of component.slice(1)) {
      repairByInputId.set(row.inputId, row);
    }
  }
  return [...repairByInputId.values()].sort((left, right) =>
    `${left.createdAt}:${left.takeId}:${left.inputId}`.localeCompare(
      `${right.createdAt}:${right.takeId}:${right.inputId}`
    )
  );
}

function listActiveTakeOwnedInputRows(
  session: Parameters<typeof listActiveShotVideoTakeInputAssetRecords>[0]
): ActiveTakeOwnedInputRow[] {
  return listActiveShotVideoTakeInputAssetRecords(session)
    .filter((row): row is ActiveTakeOwnedInputRow =>
      isShotVideoTakeOwnedMediaAsset(session, {
        inputKind: row.inputKind,
        assetId: row.assetId,
      })
    )
    .sort((left, right) =>
      `${left.createdAt}:${left.takeId}:${left.inputId}`.localeCompare(
        `${right.createdAt}:${right.takeId}:${right.inputId}`
      )
    );
}

function sharedInputComponents(
  rows: ActiveTakeOwnedInputRow[]
): ActiveTakeOwnedInputRow[][] {
  const byAsset = groupRows(rows, (row) => row.assetId);
  const byFile = groupRows(rows, (row) => row.assetFileId);
  const shared = new Set<ActiveTakeOwnedInputRow>();
  for (const group of [...byAsset.values(), ...byFile.values()]) {
    if (new Set(group.map((row) => row.takeId)).size > 1) {
      group.forEach((row) => shared.add(row));
    }
  }
  const components = new Map<string, ActiveTakeOwnedInputRow[]>();
  for (const row of shared) {
    const key = `${row.assetId}:${row.assetFileId}`;
    components.set(key, [...(components.get(key) ?? []), row]);
  }
  return [...components.values()].map((component) =>
    component.sort((left, right) =>
      `${left.createdAt}:${left.takeId}:${left.inputId}`.localeCompare(
        `${right.createdAt}:${right.takeId}:${right.inputId}`
      )
    )
  );
}

function groupRows(
  rows: ActiveTakeOwnedInputRow[],
  keyForRow: (row: ActiveTakeOwnedInputRow) => string
): Map<string, ActiveTakeOwnedInputRow[]> {
  const grouped = new Map<string, ActiveTakeOwnedInputRow[]>();
  for (const row of rows) {
    const key = keyForRow(row);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return grouped;
}

function repairedPreparedInputs(input: {
  preparedInputs: ShotVideoTakePreparedInput[] | undefined;
  row: ActiveTakeOwnedInputRow;
  assetId: string;
  assetFileId: string;
}): ShotVideoTakePreparedInput[] | undefined {
  let repaired = false;
  const preparedInputs = input.preparedInputs?.map((preparedInput) => {
    if (!preparedInputMatchesInputRow(preparedInput, input.row)) {
      return preparedInput;
    }
    repaired = true;
    return {
      ...preparedInput,
      assetId: input.assetId,
      assetFileId: input.assetFileId,
    };
  });
  return repaired ? preparedInputs : input.preparedInputs;
}

function preparedInputMatchesInputRow(
  preparedInput: ShotVideoTakePreparedInput,
  row: ActiveTakeOwnedInputRow
): boolean {
  return (
    preparedInput.kind === row.inputKind &&
    preparedInput.assetId === row.assetId &&
    preparedInput.assetFileId === row.assetFileId &&
    preparedInput.subjectKind === row.subjectKind &&
    preparedInput.subjectId === row.subjectId
  );
}

function repairResourceKeys(
  repairedInputs: ShotVideoTakeOwnedMediaRepairReport['repairedInputs']
): string[] {
  return [
    ...new Set(
      repairedInputs.flatMap((input) => [
        `scene-shot-video-take:${input.takeId}`,
        `scene-shot-video-take-input:${input.inputId}`,
        `asset:${input.assetId}`,
        `asset:${input.sourceAssetId}`,
      ])
    ),
  ];
}
