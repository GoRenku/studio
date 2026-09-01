import { ProjectDataError } from '../../project-data-error.js';
import { readShotPlanDialogueAudio } from '../../shot-plan-dialogue-audio/projection.js';
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
    kinds: input.purpose === 'shot-plan.dialogue-audio' ? [] : ['production'],
  });
  return {
    targetContext: { kind: 'shotPlan', shotPlan: plan.shotPlan, coveredBeats: plan.coveredBeats, sceneContext },
    visualLanguage,
    suggestedReferences: input.purpose === 'shot-plan.dialogue-audio'
      ? dialogueVoiceSampleSuggestions({ input, sceneContext })
      : [
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
        ? dialogueAudioSuggestions({ input })
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
}) {
  const resource = readShotPlanDialogueAudio({
    session: input.input.session,
    shotPlanId: input.input.target.kind === 'shotPlan' ? input.input.target.id : '',
  });
  return [createReferenceSuggestion({
    id: 'dialogue-audio',
    role: 'dialogue-audio',
    subject: { kind: 'shotPlan', id: resource.shotPlan.id },
    assets: resource.takes.map((take) => take.asset),
    workflowSelectedAssetIds: resource.takes
      .filter((take) => take.selected)
      .map((take) => take.asset.id),
    dialogueTurnRangesByAssetId: new Map(
      resource.takes.map((take) => [take.asset.id, take.turnRange])
    ),
    projectFolder: input.input.projectFolder,
    warnings: input.input.warnings,
  })];
}

function dialogueVoiceSampleSuggestions(input: {
  input: Parameters<MediaGenerationPurposeBuilder>[0];
  sceneContext: ReturnType<typeof projectMediaGenerationSceneContext>;
}) {
  return Object.entries(input.sceneContext.castVoicesByCastMemberId).map(
    ([castMemberId, voices]) => createReferenceSuggestion({
      id: 'voice-sample',
      role: 'voice-sample',
      subject: { kind: 'castMember', id: castMemberId },
      assets: voices.map((voice) => voice.sample),
      workflowSelectedAssetIds: voices
        .filter((voice) => voice.isDefault)
        .map((voice) => voice.sample.id),
      projectFolder: input.input.projectFolder,
      warnings: input.input.warnings,
    })
  );
}

function invalidTarget(): ProjectDataError {
  return new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Shot Plan media generation requires a Shot Plan target.');
}
