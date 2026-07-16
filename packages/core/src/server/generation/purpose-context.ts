import type { GenerationTarget, JsonValue } from '../../client/generation.js';
import { readProjectRecord } from '../database/access/project.js';
import { listSceneLocationIds } from '../database/access/navigation.js';
import { readActiveSceneBeatSheetRecord, readSceneBeatSheetDocument } from '../database/access/scene-beat-sheets.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import { effectiveProjectAspectRatio } from '../database/access/project-information.js';
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
