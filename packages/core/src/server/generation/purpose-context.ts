import type { GenerationTarget, JsonValue } from '../../client/generation.js';
import { readProjectRecord } from '../database/access/project.js';
import { readActivePropDesignDocument } from '../database/access/prop-designs.js';
import { readPropRecord } from '../database/access/props.js';
import { listSceneLocationIds } from '../database/access/navigation.js';
import { readActiveSceneBeatSheetRecord, readSceneBeatSheetDocument } from '../database/access/scene-beat-sheets.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { effectiveProjectAspectRatio } from '../database/access/project-information.js';
import { renderScreenplaySceneContextText } from '../screenplay-scene-context-text.js';
import { requireShotInPlan, requireShotRecord } from '../database/access/shot-plans/shot-records.js';
import { requireShotPlanRecord } from '../database/access/shot-plans/plan-records.js';
import { parseStoredShotBrief } from '../shot-plans/validation.js';

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
  const screenplay = readScreenplayDocumentFromSession(input.session);
  const scene = screenplay?.acts
    .flatMap((act) => act.sequences)
    .flatMap((sequence) => sequence.scenes)
    .find((candidate) => candidate.id === input.target.id);
  if (!screenplay || !scene) {
    throw new ProjectDataError(
      'CORE_GENERATION_TARGET_NOT_FOUND',
      `Scene was not found: ${input.target.id}.`
    );
  }
  const activeBeatSheetRecord = readActiveSceneBeatSheetRecord(
    input.session,
    input.target.id
  );
  const beatSheet = activeBeatSheetRecord
    ? readSceneBeatSheetDocument({ row: activeBeatSheetRecord, screenplay })
    : null;
  const sceneCastMemberIds = orderedUnique([
    ...scene.blocks.flatMap((block) => [
      ...(block.type === 'dialogue' && block.castMemberId ? [block.castMemberId] : []),
      ...(block.castMemberIds ?? []),
    ]),
    ...(beatSheet?.beats.flatMap((beat) => beat.castMemberIds) ?? []),
  ]).filter((castMemberId) =>
    !screenplay.cast.find((member) => member.id === castMemberId)?.isVoiceOver
  );
  const sceneLocationIds = orderedUnique([
    ...(scene.setting.locationIds ?? []),
    ...listSceneLocationIds(input.session, input.target.id),
    ...scene.blocks.flatMap((block) => block.locationIds ?? []),
    ...(beatSheet?.beats.flatMap((beat) => beat.locationIds) ?? []),
  ]);
  const sceneDialogueIds = scene.blocks.flatMap((block) =>
    block.type === 'dialogue' ? [block.dialogueId] : []
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
