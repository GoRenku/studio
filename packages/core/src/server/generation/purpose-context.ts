import { and, asc, eq, isNull } from 'drizzle-orm';
import type { GenerationTarget, JsonValue } from '../../client/generation.js';
import { readProjectRecord } from '../database/access/project.js';
import { listSceneLocationIds } from '../database/access/navigation.js';
import { readActiveSceneShotListRecord, readSceneShotListDocument, readSceneShotListRecord } from '../database/access/scene-shot-lists.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { sceneShotVideoTakes, sceneShotVideoTakeShots } from '../schema/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { effectiveProjectAspectRatio } from '../database/access/project-information.js';
import { parseShotVideoTakeState } from '../shot-video-take-workspace/state.js';
import { renderScreenplaySceneContextText } from '../screenplay-scene-context-text.js';

export function buildGenerationPurposeFacts(input: {
  target: GenerationTarget;
  session: DatabaseSession;
  authored?: Record<string, JsonValue>;
}): Record<string, JsonValue> {
  const projectAspectRatio = effectiveProjectAspectRatio(readProjectRecord(input.session)?.aspectRatio);
  if (input.target.kind === 'scene') {
    return buildSceneGenerationFacts({
      target: input.target,
      session: input.session,
      authored: input.authored,
    }, projectAspectRatio);
  }
  if (input.target.kind !== 'sceneShotVideoTake') {
    return { projectAspectRatio, ...(input.authored ?? {}) };
  }
  const take = input.session.db
    .select()
    .from(sceneShotVideoTakes)
    .where(and(eq(sceneShotVideoTakes.id, input.target.id), isNull(sceneShotVideoTakes.discardedAt)))
    .get();
  if (!take) {
    throw new ProjectDataError('CORE_GENERATION_TARGET_NOT_FOUND', `Scene Shot Video Take was not found: ${input.target.id}.`);
  }
  const screenplay = readScreenplayDocumentFromSession(input.session);
  const shotListRecord = readSceneShotListRecord(input.session, take.sourceShotListId);
  if (!screenplay || !shotListRecord) {
    throw new ProjectDataError('CORE_GENERATION_CONTEXT_UNAVAILABLE', `Shot context is unavailable for take ${input.target.id}.`);
  }
  const shotList = readSceneShotListDocument({ row: shotListRecord, screenplay });
  const takeShotIds = input.session.db
    .select({ shotId: sceneShotVideoTakeShots.shotId })
    .from(sceneShotVideoTakeShots)
    .where(and(eq(sceneShotVideoTakeShots.takeId, take.id), isNull(sceneShotVideoTakeShots.discardedAt)))
    .orderBy(asc(sceneShotVideoTakeShots.shotOrder))
    .all()
    .map((row) => row.shotId);
  const shots = shotList.shots.filter((shot) => takeShotIds.includes(shot.shotId));
  const scene = screenplay.acts.flatMap((act) => act.sequences).flatMap((sequence) => sequence.scenes).find((candidate) => candidate.id === take.sceneId);
  const state = parseShotVideoTakeState({ value: take.stateJson, shotIds: takeShotIds });
  const dialogueIds = shots.flatMap((shot) => shot.dialogue.flatMap((dialogue) => {
    const block = scene?.blocks[dialogue.blockIndex];
    return block?.type === 'dialogue' && block.dialogueId ? [block.dialogueId] : [];
  }));
  const sceneCastMemberIds = orderedUnique([
    ...(scene?.blocks.flatMap((block) => [
      ...(block.type === 'dialogue' && block.castMemberId ? [block.castMemberId] : []),
      ...(block.castMemberIds ?? []),
    ]) ?? []),
    ...shotList.shots.flatMap((shot) => shot.castMemberIds),
  ]).filter((castMemberId) =>
    !screenplay.cast.find((member) => member.id === castMemberId)?.isVoiceOver
  );
  const sceneLocationIds = orderedUnique([
    ...(scene?.setting.locationIds ?? []),
    ...listSceneLocationIds(input.session, take.sceneId),
    ...(scene?.blocks.flatMap((block) => block.locationIds ?? []) ?? []),
    ...shotList.shots.flatMap((shot) => shot.locationIds),
  ]);
  return {
    projectAspectRatio,
    sceneId: take.sceneId,
    shotIds: takeShotIds,
    castMemberIds: [...new Set(shots.flatMap((shot) => shot.castMemberIds))],
    locationIds: [...new Set(shots.flatMap((shot) => shot.locationIds))],
    dialogueIds: [...new Set(dialogueIds)],
    structureMode: state.structure.mode,
    sceneCastMemberIds,
    sceneLocationIds,
    shotContexts: shots.map((shot) => ({
      shotId: shot.shotId,
      castMemberIds: shot.castMemberIds,
      locationIds: shot.locationIds,
      dialogueIds: shot.dialogue.flatMap((dialogue) => {
        const block = scene?.blocks[dialogue.blockIndex];
        return block?.type === 'dialogue' && block.dialogueId
          ? [block.dialogueId]
          : [];
      }),
    })),
    ...(takeShotIds.length === 1 ? { shotId: takeShotIds[0]! } : {}),
    ...(input.authored ?? {}),
  };
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
  const activeShotListRecord = readActiveSceneShotListRecord(
    input.session,
    input.target.id
  );
  const shotList = activeShotListRecord
    ? readSceneShotListDocument({ row: activeShotListRecord, screenplay })
    : null;
  const sceneCastMemberIds = orderedUnique([
    ...scene.blocks.flatMap((block) => [
      ...(block.type === 'dialogue' && block.castMemberId ? [block.castMemberId] : []),
      ...(block.castMemberIds ?? []),
    ]),
    ...(shotList?.shots.flatMap((shot) => shot.castMemberIds) ?? []),
  ]).filter((castMemberId) =>
    !screenplay.cast.find((member) => member.id === castMemberId)?.isVoiceOver
  );
  const sceneLocationIds = orderedUnique([
    ...(scene.setting.locationIds ?? []),
    ...listSceneLocationIds(input.session, input.target.id),
    ...scene.blocks.flatMap((block) => block.locationIds ?? []),
    ...(shotList?.shots.flatMap((shot) => shot.locationIds) ?? []),
  ]);
  return {
    projectAspectRatio,
    contextText: renderScreenplaySceneContextText({ scene, screenplay }),
    sceneCastMemberIds,
    sceneLocationIds,
    ...(input.authored ?? {}),
  };
}

function orderedUnique(values: string[]): string[] {
  return [...new Set(values)];
}
