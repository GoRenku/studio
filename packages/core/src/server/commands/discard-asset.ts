import type { AssetTarget, RecoverableMutationReport } from '../../client/index.js';
import {
  readAssetRelationship,
} from '../database/access/asset-relationships/index.js';
import {
  sceneShotVideoTakes,
  sceneShotVideoTakeVideos,
} from '../schema/index.js';
import { and, eq, isNull } from 'drizzle-orm';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { assertAssetIsNotCastVoiceSample } from './cast-voice-commands.js';
import { readProjectRecord } from '../database/access/project.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { discardTrashObject } from '../trash/trash-lifecycle-service.js';
import { assetRelationshipTrashItemId } from '../trash/trash-object-registry.js';
import { listGenerationSpecRecords } from '../database/access/media-generation.js';

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
  const reference = listGenerationSpecRecords(session, {
    purpose: 'shot.video-take',
  }).find((record) =>
    record.spec.target.kind === 'sceneShotVideoTake' &&
    record.spec.references.some((selection) =>
      selection.reference.kind === 'asset-file' &&
      selection.reference.assetId === assetId
    ) &&
    session.db
      .select({ id: sceneShotVideoTakes.id })
      .from(sceneShotVideoTakes)
      .where(and(
        eq(sceneShotVideoTakes.id, record.spec.target.id),
        isNull(sceneShotVideoTakes.discardedAt)
      ))
      .get() !== undefined
  );
  const video = session.db
    .select({ takeId: sceneShotVideoTakeVideos.takeId })
    .from(sceneShotVideoTakeVideos)
    .innerJoin(
      sceneShotVideoTakes,
      eq(sceneShotVideoTakeVideos.takeId, sceneShotVideoTakes.id)
    )
    .where(and(
      eq(sceneShotVideoTakeVideos.assetId, assetId),
      isNull(sceneShotVideoTakeVideos.discardedAt),
      isNull(sceneShotVideoTakes.discardedAt)
    ))
    .get();
  if (reference || video) {
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
