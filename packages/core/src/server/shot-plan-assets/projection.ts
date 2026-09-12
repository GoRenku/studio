import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type {
  ShotPlanAssetGroup,
  ShotPlanAssets,
} from '../../client/shot-plan-assets.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { readOwnedAsset } from '../assets/projection.js';
import { assets } from '../schema/index.js';
import { withProject } from '../project-operation.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { studioShotPlanAssetsResourceKey } from '../studio-coordination/resource-keys.js';

const groupDefinitions = [
  { role: 'first-frame', type: 'shot_plan_video_first_frame' },
  { role: 'last-frame', type: 'shot_plan_video_last_frame' },
  { role: 'storyboard', type: 'shot_plan_video_storyboard' },
  { role: 'reference', type: 'shot_plan_video_reference' },
] as const;

export async function readShotPlanAssets(
  input: RenkuConfigPathOptions & { projectName?: string; shotPlanId: string },
): Promise<ShotPlanAssets> {
  return withProject(input, ({ session }) => {
    const shotPlan = requireShotPlanRecord(session, input.shotPlanId);
    const rows = session.db
      .select({ id: assets.id, type: assets.type })
      .from(assets)
      .where(and(
        eq(assets.authoredFromShotPlanId, shotPlan.id),
        inArray(assets.type, groupDefinitions.map(({ type }) => type)),
        or(eq(assets.mediaKind, 'image'), and(
          eq(assets.type, 'shot_plan_video_reference'),
          inArray(assets.mediaKind, ['video', 'audio']),
        )),
        isNull(assets.discardedAt),
      ))
      .orderBy(assets.createdAt, assets.id)
      .all();
    const groups = groupDefinitions.flatMap(({ role, type }) => {
      const groupedAssets = rows
        .filter((row) => row.type === type)
        .flatMap((row) => {
          const asset = readOwnedAsset(session, { owner: { kind: 'project' }, assetId: row.id });
          return asset ? [asset] : [];
        });
      return groupedAssets.length > 0
        ? [{ role, assets: groupedAssets } satisfies ShotPlanAssetGroup]
        : [];
    });
    return {
      shotPlan: { id: shotPlan.id, sceneId: shotPlan.sceneId, title: shotPlan.title },
      groups,
      resourceKeys: [studioShotPlanAssetsResourceKey(shotPlan.id)],
    };
  });
}
