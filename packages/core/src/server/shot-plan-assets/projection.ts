import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type {
  ShotPlanAssetFileGroup,
  ShotPlanAssetFiles,
} from '../../client/shot-plan-assets.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { readOwnedAssetFile } from '../asset-files/projection.js';
import { assetFiles } from '../schema/index.js';
import { withProject } from '../project-operation.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { studioShotPlanAssetFilesResourceKey } from '../studio-coordination/resource-keys.js';

const groupDefinitions = [
  { role: 'first-frame', type: 'shot_plan_video_first_frame' },
  { role: 'last-frame', type: 'shot_plan_video_last_frame' },
  { role: 'storyboard', type: 'shot_plan_video_storyboard' },
  { role: 'reference', type: 'shot_plan_video_reference' },
] as const;

export async function readShotPlanAssetFiles(
  input: RenkuConfigPathOptions & { projectName?: string; shotPlanId: string },
): Promise<ShotPlanAssetFiles> {
  return withProject(input, ({ session }) => {
    const shotPlan = requireShotPlanRecord(session, input.shotPlanId);
    const rows = session.db
      .select({ id: assetFiles.id, type: assetFiles.type })
      .from(assetFiles)
      .where(and(
        eq(assetFiles.authoredFromShotPlanId, shotPlan.id),
        inArray(assetFiles.type, groupDefinitions.map(({ type }) => type)),
        or(eq(assetFiles.mediaKind, 'image'), and(
          eq(assetFiles.type, 'shot_plan_video_reference'),
          inArray(assetFiles.mediaKind, ['video', 'audio']),
        )),
        isNull(assetFiles.discardedAt),
      ))
      .orderBy(assetFiles.createdAt, assetFiles.id)
      .all();
    const groups = groupDefinitions.flatMap(({ role, type }) => {
      const groupedAssetFiles = rows
        .filter((row) => row.type === type)
        .flatMap((row) => {
          const assetFile = readOwnedAssetFile(session, { owner: { kind: 'project' }, assetFileId: row.id });
          return assetFile ? [assetFile] : [];
        });
      return groupedAssetFiles.length > 0
        ? [{ role, assetFiles: groupedAssetFiles } satisfies ShotPlanAssetFileGroup]
        : [];
    });
    return {
      shotPlan: { id: shotPlan.id, sceneId: shotPlan.sceneId, title: shotPlan.title },
      groups,
      resourceKeys: [studioShotPlanAssetFilesResourceKey(shotPlan.id)],
    };
  });
}
