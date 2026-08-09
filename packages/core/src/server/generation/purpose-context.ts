import type { GenerationTarget, JsonValue } from '../../client/generation.js';
import { readProjectRecord } from '../database/access/project.js';
import { readActivePropDesignDocument } from '../database/access/prop-designs.js';
import { readPropRecord } from '../database/access/props.js';
import { listCastMemberRecords } from '../database/access/cast-members.js';
import { readActiveSceneBeatsRevisionRecord, readSceneBeats } from '../database/access/scene-beats.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { effectiveProjectAspectRatio } from '../database/access/project-information.js';
import { renderScreenplaySceneContextText } from '../screenplay/context/scene-text.js';
import { requireShotInPlan, requireShotRecord } from '../database/access/shot-plans/shot-records.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { parseStoredShotBrief } from '../shot-plans/validation.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';

export function buildGenerationPurposeFacts(input: {
  target: GenerationTarget;
  session: DatabaseSession;
  authored?: Record<string, JsonValue>;
}): Record<string, JsonValue> {
  const projectAspectRatio = effectiveProjectAspectRatio(readProjectRecord(input.session)?.aspectRatio);
  if (input.target.kind === 'prop') {
    const prop = readPropRecord(input.session, input.target.id);
    if (!prop) {
      throw new ProjectDataError(
        'CORE_GENERATION_TARGET_NOT_FOUND',
        `Prop was not found: ${input.target.id}.`
      );
    }
    const activePropDesign = readActivePropDesignDocument(
      input.session,
      input.target.id
    );
    return {
      projectAspectRatio,
      propId: prop.id,
      propHandle: prop.handle,
      propName: prop.name,
      ...(prop.description ? { propDescription: prop.description } : {}),
      ...(prop.visualNotes ? { propVisualNotes: prop.visualNotes } : {}),
      activePropDesign: (activePropDesign?.document ?? null) as JsonValue,
      ...(input.authored ?? {}),
    };
  }
  if (input.target.kind === 'scene') {
    return buildSceneGenerationFacts({
      target: input.target,
      session: input.session,
      authored: input.authored,
    }, projectAspectRatio);
  }
  if (input.target.kind === 'shot') {
    const shot = requireShotRecord(input.session, input.target.id);
    const shotPlan = requireShotPlanRecord(input.session, shot.shotPlanId);
    requireShotInPlan(input.session, {
      shotPlanId: shotPlan.id,
      shotId: shot.id,
    });
    return {
      ...buildSceneGenerationFacts(
        {
          target: { kind: 'scene', id: shotPlan.sceneId },
          session: input.session,
          authored: input.authored,
        },
        projectAspectRatio
      ),
      shotPlanId: shotPlan.id,
      shotId: shot.id,
      shotTitle: shot.title,
      shotDescription: shot.description,
      shotBrief: parseStoredShotBrief(shot.brief, shot.id) as JsonValue,
    };
  }
  return { projectAspectRatio, ...(input.authored ?? {}) };
}

function buildSceneGenerationFacts(
  input: {
    target: Extract<GenerationTarget, { kind: 'scene' }>;
    session: DatabaseSession;
    authored?: Record<string, JsonValue>;
  },
  projectAspectRatio: string
): Record<string, JsonValue> {
  const screenplay = readCanonicalScreenplay(input.session);
  const scene = screenplay.scenes.find((candidate) => candidate.id === input.target.id);
  if (!scene) {
    throw new ProjectDataError(
      'CORE_GENERATION_TARGET_NOT_FOUND',
      `Scene was not found: ${input.target.id}.`
    );
  }
  const activeRevisionRecord = readActiveSceneBeatsRevisionRecord(
    input.session,
    input.target.id
  );
  const revision = activeRevisionRecord
    ? readSceneBeats({ row: activeRevisionRecord })
    : null;
  const sceneReferences = screenplay.references.filter(
    (reference) => 'sceneId' in reference.target && reference.target.sceneId === scene.id,
  );
  const voiceOverIds = new Set(
    listCastMemberRecords(input.session)
      .filter((member) => member.isVoiceOver)
      .map((member) => member.id),
  );
  const sceneCastMemberIds = orderedUnique([
    ...sceneReferences.flatMap((reference) =>
      reference.subject.type === 'castMember' ? [reference.subject.id] : []),
    ...(revision?.beats.flatMap((beat) => beat.castMemberIds) ?? []),
  ]).filter((castMemberId) => !voiceOverIds.has(castMemberId));
  const sceneLocationIds = orderedUnique([
    ...sceneReferences.flatMap((reference) =>
      reference.subject.type === 'location' ? [reference.subject.id] : []),
    ...(revision?.beats.flatMap((beat) => beat.locationIds) ?? []),
  ]);
  const sceneDialogueIds = scene.blocks.flatMap((block) =>
    block.type === 'dialogue'
      ? [block.id]
      : block.type === 'dualDialogue'
        ? [block.left.id, block.right.id]
        : []
  );
  return {
    projectAspectRatio,
    contextText: renderScreenplaySceneContextText({ scene, screenplay }),
    sceneCastMemberIds,
    sceneLocationIds,
    sceneDialogueIds,
    ...(input.authored ?? {}),
  };
}

function orderedUnique(values: string[]): string[] {
  return [...new Set(values)];
}
