import type { AssetMetadataInput } from '../../client/assets.js';
import type { MediaPurpose, MediaTarget } from '../../client/media-attachments.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import type { SceneStoryboardImagesImportDocument } from '../../client/scene-beats/index.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { createRandomIdGenerator } from '../entity-ids.js';
import { attachGenerationMedia } from '../generation/attachments.js';
import { attachSceneStoryboardImages } from '../generation/scene-storyboard-attachments.js';
import { withProject } from '../project-operation.js';
import { readAssetMediaGenerationRequest } from '../media-generation-review/inspection.js';
import { readMediaGenerationPreview } from '../media-generation-review/preview.js';
import { updateMediaGenerationPreviewPrompt } from '../media-generation-review/prompt.js';
import { readSceneDialogueAudioWorkspace } from '../scene-dialogue-audio-workspace/context.js';
import {
  replaceSceneDialogueAudioSetup,
  updateSceneDialogueAudioSetup,
} from '../scene-dialogue-audio-workspace/setup.js';
import { discardSceneDialogueAudioTake } from '../scene-dialogue-audio-workspace/takes.js';
import {
  clearSceneDialogueAudioTakeSelection,
  selectSceneDialogueAudioTake,
} from '../scene-dialogue-audio-workspace/selection.js';
import { readMediaGenerationContext } from '../media-generation-context/index.js';

type ProjectInput = RenkuConfigPathOptions & { projectName?: string };

export function createGenerationServiceWiring() {
  return {
    readMediaGenerationPreview,
    updateMediaGenerationPreviewPrompt,
    readAssetMediaGenerationRequest,
    readMediaGenerationContext,
    async readSceneDialogueAudioWorkspace(input: ProjectInput & { sceneId: string }) {
      return withProject(input, ({ session }) =>
        readSceneDialogueAudioWorkspace({ session, sceneId: input.sceneId })
      );
    },
    async updateSceneDialogueAudioSetup(input: ProjectInput & {
      sceneId: string;
      turnId: string;
      setup: Partial<import('../../client/scene-dialogue-audio-workspace.js').SceneDialogueAudioSetup>;
    }) {
      return withProject(input, ({ session }) =>
        updateSceneDialogueAudioSetup({
          ...input,
          session,
          idGenerator: createRandomIdGenerator(),
          now: new Date().toISOString(),
        })
      );
    },
    async replaceSceneDialogueAudioSetup(input: ProjectInput & {
      sceneId: string;
      turnId: string;
      setup: unknown;
    }) {
      return withProject(input, ({ session }) =>
        replaceSceneDialogueAudioSetup({
          ...input,
          session,
          idGenerator: createRandomIdGenerator(),
          now: new Date().toISOString(),
        })
      );
    },
    async deleteSceneDialogueAudioTake(input: ProjectInput & {
      sceneId: string;
      turnId: string;
      takeId: string;
    }) {
      return withProject(input, ({ session, projectFolder }) =>
        discardSceneDialogueAudioTake({ ...input, session, projectFolder })
      );
    },
    async selectSceneDialogueAudioTake(input: ProjectInput & {
      sceneId: string;
      turnId: string;
      takeId: string;
    }) {
      return withProject(input, ({ session }) =>
        selectSceneDialogueAudioTake({
          ...input,
          session,
          now: new Date().toISOString(),
        })
      );
    },
    async clearSceneDialogueAudioTakeSelection(input: ProjectInput & {
      sceneId: string;
      turnId: string;
    }) {
      return withProject(input, ({ session }) =>
        clearSceneDialogueAudioTakeSelection({ ...input, session })
      );
    },
    async attachGenerationMedia(input: ProjectInput & {
      purpose: MediaPurpose;
      target: MediaTarget;
      sourceProjectRelativePath: string;
      title?: string;
      assetMetadata?: AssetMetadataInput;
      generationProvenance?: MediaGenerationProvenance;
      select?: boolean;
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
