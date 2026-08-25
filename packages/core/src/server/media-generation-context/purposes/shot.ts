import { readShotRecord } from '../../database/access/shot-plans/shot-records.js';
import { ProjectDataError } from '../../project-data-error.js';
import { projectShotPlanReport } from '../../shot-plans/projection.js';
import type { MediaGenerationPurposeBuilder } from '../purpose-registry.js';
import { suggestBeatStoryboards, suggestLookbookMedia, suggestSceneSubjectMedia, suggestSelectedShotImages } from '../reference-suggestions.js';
import { projectMediaGenerationSceneContext } from '../scene-context.js';
import { readMediaGenerationLookbooks } from '../visual-language-context.js';

export const buildShotPurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'shot') {
    throw invalidTarget();
  }
  const shotRecord = readShotRecord(input.session, input.target.id);
  if (!shotRecord) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND',
      `Media generation target Shot was not found: ${input.target.id}.`,
    );
  }
  const plan = projectShotPlanReport({
    session: input.session,
    projectFolder: input.projectFolder,
    shotPlanId: shotRecord.shotPlanId,
  });
  const shot = plan.shotPlan.shots.find((candidate) => candidate.id === input.target.id);
  if (!shot) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND',
      `Media generation target Shot was not found: ${input.target.id}.`,
    );
  }
  const sceneContext = projectMediaGenerationSceneContext({
    session: input.session,
    screenplay: input.screenplay,
    sceneId: plan.shotPlan.sceneId,
    scope: plan.shotPlan.coverage
      ? {
          sceneBeatsRevisionId: plan.shotPlan.coverage.sceneBeatsRevisionId,
          beatIds: plan.shotPlan.coverage.beatIds,
        }
      : undefined,
    warnings: input.warnings,
  });
  const visualLanguage = readMediaGenerationLookbooks({
    session: input.session,
    projectFolder: input.projectFolder,
    kinds: ['production'],
  });
  return {
    targetContext: { kind: 'shot', shot, shotPlan: plan.shotPlan, coveredBeats: plan.coveredBeats, sceneContext },
    visualLanguage,
    suggestedReferences: [
      ...suggestLookbookMedia({
        lookbooks: visualLanguage,
        role: 'appearance',
        projectFolder: input.projectFolder,
        warnings: input.warnings,
      }),
      ...suggestSceneSubjectMedia({
        sceneContext,
        projectFolder: input.projectFolder,
        warnings: input.warnings,
      }),
      ...suggestBeatStoryboards({
        session: input.session,
        sceneId: plan.shotPlan.sceneId,
        beatIds: plan.coveredBeats.map(({ beat }) => beat.id),
        projectFolder: input.projectFolder,
        warnings: input.warnings,
      }),
      ...suggestSelectedShotImages({
        shots: plan.shotPlan.shots.filter((candidate) => candidate.id !== shot.id),
        projectFolder: input.projectFolder,
        warnings: input.warnings,
      }),
    ],
    resourceKeys: plan.resourceKeys,
  };
};

function invalidTarget(): ProjectDataError {
  return new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Shot image generation requires a Shot target.');
}
