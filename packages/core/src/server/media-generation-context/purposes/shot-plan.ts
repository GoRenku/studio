import { ProjectDataError } from '../../project-data-error.js';
import { readOwnedAsset } from '../../assets/projection.js';
import { readSceneDialogueAudioWorkspace } from '../../scene-dialogue-audio-workspace/context.js';
import { projectShotPlanReport } from '../../shot-plans/projection.js';
import type { MediaGenerationPurposeBuilder } from '../purpose-registry.js';
import { createReferenceSuggestion, suggestBeatStoryboards, suggestLookbookMedia, suggestSceneSubjectMedia, suggestSelectedShotImages, suggestShotPlanMedia } from '../reference-suggestions.js';
import { projectMediaGenerationSceneContext } from '../scene-context.js';
import { readMediaGenerationLookbooks } from '../visual-language-context.js';

export const buildShotPlanPurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'shotPlan') {
    throw invalidTarget();
  }
  let plan;
  try {
    plan = projectShotPlanReport({
      session: input.session,
      projectFolder: input.projectFolder,
      shotPlanId: input.target.id,
    });
  } catch (error) {
    if (error instanceof ProjectDataError && error.code === 'CORE_SHOT_PLAN_NOT_FOUND') {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_CONTEXT_TARGET_NOT_FOUND',
        `Media generation target Shot Plan was not found: ${input.target.id}.`,
      );
    }
    throw error;
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
    targetContext: { kind: 'shotPlan', shotPlan: plan.shotPlan, coveredBeats: plan.coveredBeats, sceneContext },
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
        shots: plan.shotPlan.shots,
        projectFolder: input.projectFolder,
        warnings: input.warnings,
      }),
      ...suggestShotPlanMedia({
        session: input.session,
        shotPlanId: plan.shotPlan.id,
        roles: auxiliaryRoles(input.purpose),
        projectFolder: input.projectFolder,
        warnings: input.warnings,
      }),
      ...(input.purpose === 'shot-plan.video-generation'
        ? dialogueAudioSuggestions({ input, sceneContext })
        : []),
    ],
    resourceKeys: plan.resourceKeys,
  };
};

function auxiliaryRoles(purpose: Parameters<MediaGenerationPurposeBuilder>[0]['purpose']) {
  const all = [
    { assetType: 'shot_plan_video_first_frame', role: 'first-frame' as const },
    { assetType: 'shot_plan_video_last_frame', role: 'last-frame' as const },
    { assetType: 'shot_plan_video_storyboard', role: 'video-storyboard' as const },
    { assetType: 'shot_plan_video_reference', role: 'video-reference' as const },
  ];
  if (purpose === 'shot-plan.video-generation') {
    return all;
  }
  if (purpose === 'shot-plan.video-last-frame') {
    return all.slice(0, 1);
  }
  if (purpose === 'shot-plan.video-storyboard') {
    return all.slice(2, 3);
  }
  if (purpose === 'shot-plan.video-reference') {
    return all.slice(3, 4);
  }
  return [];
}

function dialogueAudioSuggestions(input: {
  input: Parameters<MediaGenerationPurposeBuilder>[0];
  sceneContext: ReturnType<typeof projectMediaGenerationSceneContext>;
}) {
  const workspace = readSceneDialogueAudioWorkspace({
    session: input.input.session,
    sceneId: input.sceneContext.scene.id,
  });
  return input.sceneContext.dialogueTurns.map((turn) => {
    const assets = (workspace.audioByTurnId[turn.turnId]?.takes ?? []).flatMap((take) => {
      const asset = readOwnedAsset(input.input.session, {
        owner: { kind: 'scene', id: input.sceneContext.scene.id },
        assetId: take.assetId,
      });
      return asset ? [asset] : [];
    });
    return createReferenceSuggestion({
      id: 'dialogue-audio',
      role: 'dialogue-audio',
      subject: { kind: 'dialogueTurn', id: turn.turnId },
      assets,
      workflowSelectedAssetIds: workspace.audioByTurnId[turn.turnId]?.selectedTakeId
        ? workspace.audioByTurnId[turn.turnId]!.takes
            .filter((take) => take.takeId === workspace.audioByTurnId[turn.turnId]!.selectedTakeId)
            .map((take) => take.assetId)
        : [],
      projectFolder: input.input.projectFolder,
      warnings: input.input.warnings,
    });
  });
}

function invalidTarget(): ProjectDataError {
  return new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Shot Plan video generation requires a Shot Plan target.');
}
