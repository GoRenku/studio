import { ProjectDataError } from '../../project-data-error.js';
import { sceneBeatsResourceKeys } from '../../scene-beats/storyboard-status.js';
import type { MediaGenerationPurposeBuilder } from '../purpose-registry.js';
import { suggestBeatStoryboards, suggestLookbookMedia, suggestSceneSubjectMedia } from '../reference-suggestions.js';
import { projectMediaGenerationSceneContext } from '../scene-context.js';
import { readMediaGenerationLookbooks } from '../visual-language-context.js';

export const buildScenePurposeContext: MediaGenerationPurposeBuilder = (input) => {
  if (input.target.kind !== 'scene') {
    throw new ProjectDataError('CORE_GENERATION_TARGET_INVALID', 'Scene Storyboard generation requires a Scene target.');
  }
  const sceneContext = projectMediaGenerationSceneContext({
    session: input.session,
    screenplay: input.screenplay,
    sceneId: input.target.id,
    scope: input.sceneStoryboardScope,
    warnings: input.warnings,
  });
  const visualLanguage = readMediaGenerationLookbooks({ session: input.session, projectFolder: input.projectFolder, kinds: ['storyboard'] });
  return {
    targetContext: sceneContext,
    visualLanguage,
    suggestedReferences: [
      ...suggestLookbookMedia({ lookbooks: visualLanguage, role: 'appearance', projectFolder: input.projectFolder, warnings: input.warnings }),
      ...suggestSceneSubjectMedia({ sceneContext, projectFolder: input.projectFolder, warnings: input.warnings }),
      ...suggestBeatStoryboards({ session: input.session, sceneId: sceneContext.scene.id, beatIds: sceneContext.selectedBeatIds, projectFolder: input.projectFolder, warnings: input.warnings }),
    ],
    resourceKeys: sceneBeatsResourceKeys({
      sceneId: sceneContext.scene.id,
      sceneBeatsRevisionId: sceneContext.sceneBeatsRevision?.revision.id,
      beatIds: sceneContext.selectedBeatIds,
    }),
  };
};
