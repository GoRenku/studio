import type { AssetMetadataInput } from '../../client/assets.js';
import type { MediaPurpose, MediaTarget } from '../../client/media-attachments.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import type { SceneStoryboardImagesImportDocument } from '../../client/scene-beats/index.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { resolveProjectAssetFileById } from '../assets/resources.js';
import { createRandomIdGenerator } from '../entity-ids.js';
import { attachGenerationMedia } from '../generation/attachments.js';
import { attachSceneStoryboardImages } from '../generation/scene-storyboard-attachments.js';
import { withProject } from '../project-operation.js';
import { readAssetMediaGenerationRequest } from '../media-generation-review/inspection.js';
import { readMediaGenerationPreview } from '../media-generation-review/preview.js';
import { updateMediaGenerationPreviewPrompt } from '../media-generation-review/prompt.js';
import {
  attachShotPlanDialogueAudio,
  clearShotPlanDialogueAudioTakeSelection,
  discardShotPlanDialogueAudioTake,
  readShotPlanDialogueAudio,
  requireShotPlanDialogueAudioTakeFile,
  selectShotPlanDialogueAudioTake,
} from '../shot-plan-dialogue-audio/index.js';
import { readMediaGenerationContext } from '../media-generation-context/index.js';
import { resolveStudioProjectRef } from '../studio-coordination/project-reference.js';

type ProjectInput = RenkuConfigPathOptions & { projectName?: string };

export function createGenerationServiceWiring() {
  return {
    readMediaGenerationPreview,
    updateMediaGenerationPreviewPrompt,
    readAssetMediaGenerationRequest,
    readMediaGenerationContext,
    async readShotPlanDialogueAudio(input: ProjectInput & { shotPlanId: string }) {
      return withProject(input, ({ session }) =>
        readShotPlanDialogueAudio({ session, shotPlanId: input.shotPlanId })
      );
    },
    async attachShotPlanDialogueAudio(input: ProjectInput & {
      shotPlanId: string;
      sourceProjectRelativePath: string;
      turnRange: import('../../client/shot-plan-dialogue-audio.js').DialogueTurnRange;
      generationProvenance: MediaGenerationProvenance;
      title?: string;
      assetMetadata?: AssetMetadataInput;
    }) {
      return withProject(input, ({ session, projectFolder }) =>
        attachShotPlanDialogueAudio({
          ...input,
          session,
          projectFolder,
          idGenerator: createRandomIdGenerator(),
        })
      );
    },
    async discardShotPlanDialogueAudioTake(input: ProjectInput & {
      shotPlanId: string;
      takeId: string;
    }) {
      return withProject(input, ({ session, projectFolder }) =>
        discardShotPlanDialogueAudioTake({ ...input, session, projectFolder })
      );
    },
    async selectShotPlanDialogueAudioTake(input: ProjectInput & {
      shotPlanId: string;
      takeId: string;
    }) {
      return withProject(input, ({ session }) =>
        selectShotPlanDialogueAudioTake({
          ...input,
          session,
          now: new Date().toISOString(),
        })
      );
    },
    async clearShotPlanDialogueAudioTakeSelection(input: ProjectInput & {
      shotPlanId: string;
      takeId: string;
    }) {
      return withProject(input, ({ session }) =>
        clearShotPlanDialogueAudioTakeSelection({
          ...input,
          session,
          now: new Date().toISOString(),
        })
      );
    },
    async resolveShotPlanDialogueAudioTakeFile(input: ProjectInput & {
      shotPlanId: string;
      takeId: string;
      assetFileId: string;
    }) {
      const project = await resolveStudioProjectRef(input);
      const coordinates = await withProject(
        { ...input, projectName: project.name },
        ({ session }) => requireShotPlanDialogueAudioTakeFile({ ...input, session }),
      );
      return resolveProjectAssetFileById({
        homeDir: input.homeDir,
        projectName: project.name,
        ...coordinates,
      });
    },
    async attachGenerationMedia(input: ProjectInput & {
      purpose: MediaPurpose;
      target: MediaTarget;
      sourceProjectRelativePath: string;
      title?: string;
      assetMetadata?: AssetMetadataInput;
      generationProvenance?: MediaGenerationProvenance;
      select?: boolean;
      turnRange?: import('../../client/shot-plan-dialogue-audio.js').DialogueTurnRange;
    }) {
      return withProject(input, ({ session, projectFolder }) =>
        attachGenerationMedia({
          ...input,
          session,
          projectFolder,
          idGenerator: createRandomIdGenerator(),
        })
      );
    },
    async attachSceneStoryboardImages(input: ProjectInput & {
      sceneId: string;
      sceneBeatsRevisionId: string;
      document: SceneStoryboardImagesImportDocument;
    }) {
      return withProject(input, ({ session, projectFolder }) =>
        attachSceneStoryboardImages({
          ...input,
          session,
          projectFolder,
          idGenerator: createRandomIdGenerator(),
        })
      );
    },
  };
}
