import { createDiagnosticWarning } from '@gorenku/studio-diagnostics';
import type {
  GenerationGuideNotice,
  GenerationSpecAuthoredFrom,
  JsonValue,
} from '../../client/generation.js';
import { listAssetsInSession } from '../assets/projection.js';
import {
  readShotPlanRecord,
} from '../database/access/shot-plans/plan-records.js';
import { listShotRecords } from '../database/access/shot-plans/shot-records.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { parseStoredShotBrief } from '../shot-plans/validation.js';

export interface AuthoredShotPlanContext {
  sceneId: string | null;
  facts: Record<string, JsonValue>;
  notices: GenerationGuideNotice[];
}

export function resolveAuthoredShotPlanContext(input: {
  authoredFrom?: GenerationSpecAuthoredFrom;
  session: DatabaseSession;
}): AuthoredShotPlanContext {
  if (!input.authoredFrom) {
    return { sceneId: null, facts: {}, notices: [] };
  }
  const shotPlan = readShotPlanRecord(input.session, input.authoredFrom.id);
  if (!shotPlan) {
    return {
      sceneId: null,
      facts: { authoredShotPlanId: input.authoredFrom.id },
      notices: [
        createDiagnosticWarning(
          'CORE_GENERATION_AUTHORED_SHOT_PLAN_UNAVAILABLE',
          'The authored Shot Plan is unavailable for current generation context.',
          { path: ['authoredFrom', 'id'] },
          'Continue with the exact saved request or choose an active Shot Plan for current authoring context.',
        ),
      ],
    };
  }
  const shots = listShotRecords(input.session, shotPlan.id);
  return {
    sceneId: shotPlan.sceneId,
    facts: {
      authoredShotPlanId: shotPlan.id,
      authoredShotPlanTitle: shotPlan.title,
      authoredShotPlanSceneId: shotPlan.sceneId,
      authoredShotPlanShots: shots.map((shot) => {
        const imageAssets = listAssetsInSession(input.session, {
          owner: { kind: 'shot', id: shot.id },
          type: 'shot_image',
        });
        return {
          id: shot.id,
          position: shot.position,
          title: shot.title,
          description: shot.description,
          brief: parseStoredShotBrief(shot.brief, shot.id) as JsonValue,
          imageAssetFileIds: imageAssets.flatMap((asset) =>
            asset.files.map((file) => file.id)
          ),
        };
      }) as JsonValue,
    },
    notices: [],
  };
}
