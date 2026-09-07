import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { FdxSceneUpdateLabel, FdxSceneUpdateImpact } from '../../../client/screenplay/fdx-updates.js';
import type { Scene, Screenplay } from '../../../client/screenplay/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { sceneBeatsRevisions, sceneBeatsState } from '../../schema/scene-beats.js';
import { shotPlans, shots } from '../../schema/shot-plans.js';
import { shotPlanDialogueAudioTakes } from '../../schema/shot-plan-dialogue-audio.js';
import { fdxFlatScreenplayContentHash } from './content-identity.js';

export function readFdxUpdateImpact(session: DatabaseSession, current: Screenplay, proposed: Screenplay) {
  const currentIds = new Set(current.scenes.map((scene) => scene.id));
  const proposedIds = new Set(proposed.scenes.map((scene) => scene.id));
  const removed = current.scenes.filter((scene) => !proposedIds.has(scene.id));
  const evidence = readProductionEvidence(session, removed.map((scene) => scene.id));
  const removedOrReplacedScenes: FdxSceneUpdateImpact[] = removed.map((scene) => {
    const plans = new Set(evidence.plans.filter((plan) => plan.sceneId === scene.id).map((plan) => plan.id));
    return {
      ...sceneLabel(scene),
      activeSceneBeats: evidence.states.some((state) => state.sceneId === scene.id && state.activeRevisionId !== null),
      sceneBeatsRevisionCount: evidence.beats.filter((beat) => beat.sceneId === scene.id).length,
      shotPlanCount: plans.size,
      shotCount: evidence.shots.filter((shot) => plans.has(shot.shotPlanId)).length,
      dialogueAudioTakeCount: evidence.takes.filter((take) => plans.has(take.shotPlanId)).length,
    };
  });
  const oldSurvivors = current.scenes.filter((scene) => proposedIds.has(scene.id)).map((scene) => scene.id);
  const newSurvivors = proposed.scenes.filter((scene) => currentIds.has(scene.id)).map((scene) => scene.id);
  return {
    evidence,
    impact: {
      beforeSceneCount: current.scenes.length,
      afterSceneCount: proposed.scenes.length,
      retainedSceneCount: oldSurvivors.length,
      survivingSceneOrderChanged: JSON.stringify(oldSurvivors) !== JSON.stringify(newSurvivors),
      openingChanged: openingHash(current) !== openingHash(proposed),
      removedOrReplacedScenes,
      newScenes: proposed.scenes.filter((scene) => !currentIds.has(scene.id)).map(sceneLabel),
    },
  };
}

function sceneLabel(scene: Scene): FdxSceneUpdateLabel {
  return { sceneId: scene.id, heading: scene.heading,
    ...(scene.productionNumber !== undefined ? { productionNumber: scene.productionNumber } : {}),
    ...(scene.title !== undefined ? { title: scene.title } : {}),
  };
}

function openingHash(screenplay: Screenplay) {
  return fdxFlatScreenplayContentHash({ ...screenplay, scenes: [], structure: [], sections: [], references: [] });
}

// Only relational identity, lifecycle and update versions enter the evidence.
// Never select creative documents, prompts or media to infer impact.
function readProductionEvidence(session: DatabaseSession, sceneIds: string[]) {
  if (sceneIds.length === 0) {
    return { states: [], beats: [], plans: [], shots: [], takes: [] };
  }
  const states = session.db.select({ sceneId: sceneBeatsState.sceneId, activeRevisionId: sceneBeatsState.activeRevisionId,
    updatedAt: sceneBeatsState.updatedAt }).from(sceneBeatsState)
    .where(inArray(sceneBeatsState.sceneId, sceneIds)).orderBy(sceneBeatsState.sceneId).all();
  const beats = session.db.select({ id: sceneBeatsRevisions.id, sceneId: sceneBeatsRevisions.sceneId,
    updatedAt: sceneBeatsRevisions.updatedAt }).from(sceneBeatsRevisions)
    .where(inArray(sceneBeatsRevisions.sceneId, sceneIds)).orderBy(sceneBeatsRevisions.id).all();
  const livePlans = and(inArray(shotPlans.sceneId, sceneIds), isNull(shotPlans.discardedAt));
  const plans = session.db.select({ id: shotPlans.id, sceneId: shotPlans.sceneId, updatedAt: shotPlans.updatedAt })
    .from(shotPlans).where(livePlans).orderBy(shotPlans.id).all();
  const liveShots = session.db.select({ id: shots.id, shotPlanId: shots.shotPlanId, updatedAt: shots.updatedAt })
    .from(shots).innerJoin(shotPlans, eq(shotPlans.id, shots.shotPlanId))
    .where(and(livePlans, isNull(shots.discardedAt))).orderBy(shots.id).all();
  const takes = session.db.select({ id: shotPlanDialogueAudioTakes.id, shotPlanId: shotPlanDialogueAudioTakes.shotPlanId,
    updatedAt: shotPlanDialogueAudioTakes.updatedAt }).from(shotPlanDialogueAudioTakes)
    .innerJoin(shotPlans, eq(shotPlans.id, shotPlanDialogueAudioTakes.shotPlanId))
    .where(and(livePlans, isNull(shotPlanDialogueAudioTakes.discardedAt))).orderBy(shotPlanDialogueAudioTakes.id).all();
  return { states, beats, plans, shots: liveShots, takes };
}
