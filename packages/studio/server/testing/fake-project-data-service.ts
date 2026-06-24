import type {
  MediaGenerationSpec,
  LookbookSection,
  MediaGenerationSpecRecord,
  ProjectRelativePath,
  ProjectLibrary,
  SceneDialogueAudioContext,
  SceneShotVideoTakeEditContext,
  SceneShotVideoTake,
  ShotVideoTakeProductionContext,
  ShotVideoTakeOutputGenerationPlan,
  SceneShotVideoTakeProductionState,
} from '@gorenku/studio-core/client';
import { SHOT_VIDEO_TAKE_GENERATION_PURPOSE } from '@gorenku/studio-core/client';
import type { CreateProjectsRouteOptions } from '../routes/projects.js';
import { makeAsset, makeProject, makeProjectShell } from './route-fixtures.js';

export function fakeProjectDataService(): NonNullable<
  CreateProjectsRouteOptions['projectData']
> {
  const project = makeProject();
  const library: ProjectLibrary = {
    storageRoot: '/tmp/renku',
    projects: [
      {
        name: project.identity.name,
        title: project.identity.title,
        folderPath: project.identity.folderPath,
        coverImage: project.coverImage,
        counts: project.counts,
        validationError: null,
      },
    ],
  };

  return {
    async listLibrary() {
      return library;
    },
    async readProject() {
      return project;
    },
    async readProjectShell() {
      return makeProjectShell(project);
    },
    async readProjectInformationResource() {
      return {
        title: project.identity.title,
        aspectRatio: project.identity.aspectRatio,
        logline: project.identity.logline,
        languages: project.languages,
      };
    },
    async updateProjectInformation() {
      return {
        title: project.identity.title,
        aspectRatio: project.identity.aspectRatio,
        logline: project.identity.logline,
        languages: project.languages,
      };
    },
    async resolveCoverImage() {
      return '/tmp/renku/constantinople/cover.png';
    },
    async resolveProjectAssetFile(input) {
      const asset = makeAsset(input.assetId);
      return {
        asset,
        file: asset.files[0],
        absolutePath: '/tmp/renku/constantinople/cast/reference.png',
      };
    },
    async resolveShotVideoTakeInputFile(input) {
      const asset = makeAsset('asset_shot_video_input');
      return {
        input: {
          inputId: input.inputId,
          kind: 'first-frame',
          title: 'First frame',
          assetId: asset.assetId,
          assetFileId: input.assetFileId,
          mediaKind: 'image',
          projectRelativePath:
            'generated/media/shot-video-input.png' as ProjectRelativePath,
          subjectKind: 'shot',
          subjectId: 'shot_001',
          takeId: 'scene_shot_video_take_001',
          selected: true,
          shotIds: ['shot_001'],
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        file: {
          ...asset.files[0],
          id: input.assetFileId,
          projectRelativePath:
            'generated/media/shot-video-input.png' as ProjectRelativePath,
        },
        absolutePath: '/tmp/renku/constantinople/generated/media/shot-video-input.png',
      };
    },
    async listAssets() {
      return [makeAsset('asset_cast_reference')];
    },
    async listCastVoices() {
      return { voices: [] };
    },
    async readCastVoice() {
      throw new Error('Cast Voice fixture was not configured.');
    },
    async removeCastVoice(input) {
      return {
        project: {
          id: project.identity.id,
          name: project.identity.name,
        },
        removed: {
          castMemberId: input.castMemberId,
          voiceId: input.voiceIdOrName,
          sampleAssetId: 'asset_voice_sample',
        },
        changes: [
          {
            type: 'castVoice.removed' as const,
            castMemberId: input.castMemberId,
            voiceId: input.voiceIdOrName,
          },
        ],
        resourceKeys: [`assets:castMember:${input.castMemberId}`],
      };
    },
    async listAssetPage() {
      return {
        items: [makeAsset('asset_cast_reference')],
        nextCursor: null,
      };
    },
    async listCastNavigation() {
      return makeProjectShell(project).navigation.cast;
    },
    async listLocationNavigation() {
      return makeProjectShell(project).navigation.locations;
    },
    async listActNavigation() {
      return makeProjectShell(project).navigation.screenplay.acts;
    },
    async listSequenceNavigation() {
      return {
        items: [
          {
            id: 'seq_opening',
            actId: 'act_opening',
            number: 1,
            title: 'Opening',
            sceneCount: 1,
          },
        ],
        nextCursor: null,
      };
    },
    async listSceneNavigation() {
      return {
        items: [
          {
            id: 'scene_opening',
            sequenceId: 'seq_opening',
            title: 'Opening Scene',
          },
        ],
        nextCursor: null,
      };
    },
    async readCastDesignResource() {
      return {
        castMember: project.cast[0],
        selectedAssets: [],
        activeTakePage: {
          items: [makeAsset('asset_cast_reference')],
          nextCursor: null,
        },
        countsByRole: [],
      };
    },
    async readSceneDesignResource() {
      return {
        scene: {
          id: 'scene_opening',
          sequenceId: 'seq_opening',
          title: 'Opening Scene',
          setting: { locationIds: [] },
        },
        sequence: {
          id: 'seq_opening',
          actId: 'act_opening',
          number: 1,
          title: 'Opening',
          sceneCount: 1,
        },
        selectedAssets: [],
        activeTakePage: { items: [], nextCursor: null },
      };
    },
    async readStudioSelectionContext(input) {
      return {
        valid: true,
        selection: input.selection,
        context: { surface: 'project-information' },
        resourceKeys: ['project-information'],
      };
    },
    async readCastOverviewResource() {
      return { cast: makeProjectShell(project).navigation.cast };
    },
    async readCastMemberResource() {
      return { castMember: project.cast[0], voices: [] };
    },
    async updateCastMemberVoiceOverStatus() {
      return project.cast[0];
    },
    async readLocationOverviewResource() {
      return { locations: makeProjectShell(project).navigation.locations };
    },
    async readLocationResource() {
      return {
        location: {
          id: 'location_test',
          handle: 'location-test',
          name: 'Location',
        },
      };
    },
    async readStoryArcResource() {
      return {
        screenplay: { title: project.identity.title },
        acts: [
          {
            id: 'act_opening',
            title: 'Opening Act',
            sequenceCount: 1,
            sceneCount: 1,
            sequences: [
              {
                id: 'seq_opening',
                actId: 'act_opening',
                number: 1,
                title: 'Opening',
                sceneCount: 1,
                scenes: [
                  {
                    id: 'scene_opening',
                    sequenceId: 'seq_opening',
                    title: 'Opening Scene',
                    setting: { locationIds: [] },
                    storyFunction: ['Establish the siege preparations.'],
                  },
                ],
              },
            ],
          },
        ],
        activeAnalysis: null,
      };
    },
    async readSequenceResource() {
      return {
        act: {
          id: 'act_opening',
          title: 'Opening Act',
          sequenceCount: 1,
          sceneCount: 1,
        },
        sequence: {
          id: 'seq_opening',
          actId: 'act_opening',
          number: 1,
          title: 'Opening',
          sceneCount: 1,
        },
        scenes: {
          items: [
            {
              id: 'scene_opening',
              sequenceId: 'seq_opening',
              title: 'Opening Scene',
              setting: { locationIds: [] },
            },
          ],
          nextCursor: null,
        },
      };
    },
    async readSceneNarrativeResource() {
      return {
        act: {
          id: 'act_opening',
          title: 'Opening Act',
          sequenceCount: 1,
          sceneCount: 1,
        },
        sequence: {
          id: 'seq_opening',
          actId: 'act_opening',
          number: 1,
          title: 'Opening',
          sceneCount: 1,
        },
        scene: {
          id: 'scene_opening',
          title: 'Opening Scene',
          setting: { locationIds: [] },
          blocks: [{ type: 'action', text: 'The siege begins.' }],
        },
        blocks: [{ type: 'action', text: 'The siege begins.' }],
        castMemberLabels: {},
        castMemberImages: {},
        locationLabels: {},
        castMemberHandles: {},
        locationHandles: {},
        dialogueAudio: makeSceneDialogueAudioContext(project),
      };
    },
    async readSceneDialogueAudioContext() {
      return makeSceneDialogueAudioContext(project);
    },
    async estimateSceneDialogueAudioDraft(input) {
      return {
        spec: makeMediaGenerationSpecRecord(
          'media_generation_spec_dialogue_audio',
          input.spec
        ),
        providerPayload: {},
        estimate: {
          provider: 'elevenlabs',
          model: 'eleven_v3',
          mediaKind: 'audio',
          pricing: null,
          estimatedCostUsd: 0.01,
          approvalToken: 'dialogue-audio-approval-token',
          billableUnits: {},
          warnings: [],
        },
      };
    },
    async updateSceneDialogueAudioSetup() {
      return {
        context: makeSceneDialogueAudioContext(project),
        resourceKeys: [],
      };
    },
    async generateSceneDialogueAudioTake() {
      return {
        context: makeSceneDialogueAudioContext(project),
        resourceKeys: [],
      };
    },
    async pickSceneDialogueAudioTake() {
      return {
        context: makeSceneDialogueAudioContext(project),
        resourceKeys: [],
      };
    },
    async deleteSceneDialogueAudioTake() {
      return {
        context: makeSceneDialogueAudioContext(project),
        resourceKeys: [],
      };
    },
    async readSceneShotListResource() {
      return {
        scene: {
          id: 'scene_opening',
          sequenceId: 'seq_opening',
          title: 'Opening Scene',
          setting: { locationIds: [] },
        },
        sequence: {
          id: 'seq_opening',
          actId: 'act_opening',
          number: 1,
          title: 'Opening',
          sceneCount: 1,
        },
        act: {
          id: 'act_opening',
          title: 'Opening Act',
          sequenceCount: 1,
          sceneCount: 1,
        },
        projectAspectRatio: '16:9',
        activeShotListId: 'shot_list_opening',
        activeShotList: null,
        storyboardImagesByShotId: {},
        castMemberLabels: {},
        castMemberImages: {},
        locationLabels: {},
      };
    },
    async readActStoryboardResource() {
      return {
        act: {
          id: 'act_opening',
          title: 'Opening Act',
          sequenceCount: 1,
          sceneCount: 1,
        },
        sequences: [],
      };
    },
    async createAssetSelect(input) {
      return {
        ...makeAsset(input.assetId),
        selection: { kind: 'select', order: 1 },
      };
    },
    async removeAssetSelect(input) {
      return makeAsset(input.assetId);
    },
    async discardAsset(input) {
      return makeRecoverableMutationReport({
        changeType: 'asset.discarded',
        itemId: input.assetId,
        resourceKeys: [],
      });
    },
    async listTrash() {
      return {
        valid: true as const,
        warnings: [],
        project: { id: project.identity.id, name: project.identity.name },
        items: [],
        resourceKeys: ['trash:list'],
      };
    },
    async restoreTrashItem(input) {
      return makeRecoverableMutationReport({
        changeType: 'trash.restored',
        itemId: input.trashItemId,
        resourceKeys: ['trash:list'],
      });
    },
    async previewGarbageCollection() {
      return {
        valid: true as const,
        warnings: [],
        project: { id: project.identity.id, name: project.identity.name },
        confirmationToken: 'sha256:test',
        items: [],
        files: [],
        resourceKeys: ['trash:list'],
      };
    },
    async emptyTrash() {
      return {
        valid: true as const,
        warnings: [],
        project: { id: project.identity.id, name: project.identity.name },
        confirmationToken: 'sha256:test',
        items: [],
        files: [],
        dryRun: false,
        operationId: 'trash_operation_test0001',
        manifestProjectRelativePath:
          '.renku/trash/emptied/trash_operation_test0001/manifest.json',
        resourceKeys: ['trash:list'],
      };
    },
    async exportProductionAssets() {
      return {
        copiedFileCount: 1,
        skippedFileCount: 0,
        prunedFileCount: 0,
        unmanagedFileCount: 0,
        variants: [],
      };
    },
    async readInspirationResource() {
      return { folders: { items: [], nextCursor: null } };
    },
    async readInspirationFolder() {
      return {
        folder: {
          id: 'inspiration_folder_test0001',
          name: 'Reference',
          projectRelativePath: 'visual-language/inspiration/reference' as never,
        },
        images: [],
        analysis: null,
      };
    },
    async createInspirationFolder(input) {
      return {
        ...makeVisualLanguageCommandReport('inspirationFolder.created'),
        folder: {
          id: 'inspiration_folder_test0001',
          name: input.name,
          projectRelativePath: 'visual-language/inspiration/reference' as never,
        },
      };
    },
    async renameInspirationFolder(input) {
      return {
        ...makeVisualLanguageCommandReport('inspirationFolder.renamed'),
        folder: {
          id: input.folderId,
          name: input.name,
          projectRelativePath: 'visual-language/inspiration/reference' as never,
        },
      };
    },
    async reorderInspirationFolders() {
      return {
        ...makeVisualLanguageCommandReport('inspirationFolder.reordered'),
        folders: { items: [], nextCursor: null },
      };
    },
    async deleteInspirationFolder(input) {
      return {
        ...makeVisualLanguageCommandReport('inspirationFolder.deleted'),
        folderId: input.folderId,
      };
    },
    async writeInspirationImage() {
      return {
        ...makeVisualLanguageCommandReport('inspirationImage.written'),
        resource: {
          folder: {
            id: 'inspiration_folder_test0001',
            name: 'Reference',
            projectRelativePath: 'visual-language/inspiration/reference' as never,
          },
          images: [],
          analysis: null,
        },
      };
    },
    async deleteInspirationImage() {
      return {
        ...makeVisualLanguageCommandReport('inspirationImage.deleted'),
        resource: {
          folder: {
            id: 'inspiration_folder_test0001',
            name: 'Reference',
            projectRelativePath: 'visual-language/inspiration/reference' as never,
          },
          images: [],
          analysis: null,
        },
      };
    },
    async readInspirationAnalysis(input) {
      return {
        valid: true,
        warnings: [],
        project: { name: 'test-project' },
        folder: {
          id: input.folderId,
          name: 'Reference',
          projectRelativePath: 'visual-language/inspiration/reference' as never,
          absolutePath: '/tmp/reference',
        },
        analysis: null,
        resourceKeys: [],
      };
    },
    async validateInspirationAnalysis(input) {
      return {
        valid: true,
        warnings: [],
        project: { name: 'test-project' },
        folder: {
          id: input.folderId,
          name: 'Reference',
          projectRelativePath: 'visual-language/inspiration/reference' as never,
          absolutePath: '/tmp/reference',
        },
        resourceKeys: [],
      };
    },
    async writeInspirationAnalysis(input) {
      return {
        valid: true,
        warnings: [],
        project: { name: 'test-project' },
        changes: [{ type: 'inspirationAnalysis.upserted', folderId: input.folderId }],
        folder: {
          id: input.folderId,
          name: 'Reference',
          projectRelativePath: 'visual-language/inspiration/reference' as never,
          absolutePath: '/tmp/reference',
        },
        analysis: { folderId: input.folderId, ...input.document.analysis },
        resourceKeys: [],
      };
    },
    async listLookbooks() {
      return {
        valid: true,
        warnings: [],
        project: { name: 'test-project' },
        selectedLookbookIdsByType: {},
        lookbooks: [],
        resourceKeys: [],
      };
    },
    async readLookbook(input) {
      return {
        valid: true,
        warnings: [],
        project: { name: 'test-project' },
        lookbook: makeLookbook(input.lookbookId),
        sourceInspirationFolders: [],
        cardImage: null,
        isSelectedForType: false,
        images: [],
        sheets: [makeLookbookSheet('lookbook_sheet_test0001')],
        imagesBySection: {
          thesis: [],
          palette: [],
          toneMood: [],
          composition: [],
          lighting: [],
          texture: [],
          camera: [],
          styleBrief: [],
          lineAndFinish: [],
          valueAndAccent: [],
          guardrails: [],
        },
        imagesByPoint: {},
        resourceKeys: [],
      };
    },
    async createLookbook(input) {
      return makeLookbookWriteReport({
        lookbook: makeLookbook('lookbook_test0001', input.name),
      });
    },
    async updateLookbook(input) {
      return makeLookbookWriteReport({
        lookbook: makeLookbook(input.lookbookId, input.name),
      });
    },
    async renameLookbook(input) {
      return makeLookbookWriteReport({
        lookbook: makeLookbook(input.lookbookId, input.name),
      });
    },
    async validateLookbook() {
      return {
        valid: true,
        warnings: [],
        project: { name: 'test-project' },
        sourceInspirationFolders: [],
        resourceKeys: [],
      };
    },
    async deleteLookbook() {
      return makeVisualLanguageCommandReport('lookbook.deleted');
    },
    async selectLookbookForType() {
      return makeVisualLanguageCommandReport('lookbook.selectedForType');
    },
    async clearLookbookSelection() {
      return makeVisualLanguageCommandReport('lookbook.selectionCleared');
    },
    async setLookbookSourceInspirations(input) {
      return makeLookbookWriteReport({
        lookbook: makeLookbook(input.lookbookId),
      });
    },
    async listLookbookSourceInspirations(input) {
      return {
        valid: true,
        warnings: [],
        project: { name: 'test-project' },
        lookbookId: input.lookbookId,
        sourceInspirationFolders: [],
        resourceKeys: [],
      };
    },
    async setLookbookCardImage(input) {
      return makeLookbookImageMutationReport(input.lookbookId, makeLookbookImage(input.imageId));
    },
    async clearLookbookCardImage(input) {
      return makeLookbookImageMutationReport(input.lookbookId);
    },
    async buildLookbookImageContext(input) {
      return {
        purpose: 'lookbook.image',
        target: { kind: 'lookbook', id: input.lookbookId },
        project: {
          id: 'project_test',
          name: 'test-project',
          title: project.identity.title,
          aspectRatio: project.identity.aspectRatio ?? null,
        },
        lookbook: makeLookbook(input.lookbookId),
        sourceInspirationFolders: [],
        existingImages: [],
        imagesBySection: {
          thesis: [],
          palette: [],
          toneMood: [],
          composition: [],
          lighting: [],
          texture: [],
          camera: [],
          styleBrief: [],
          lineAndFinish: [],
          valueAndAccent: [],
          guardrails: [],
        },
        cardImage: null,
        defaults: {
          takeCount: 1,
          seed: null,
          imageFrame: 'project',
          resolvedAspectRatio: project.identity.aspectRatio ?? null,
          detail: 'standard',
          outputFormat: 'png',
        },
        resourceKeys: [],
      };
    },
    async listLookbookImageModels(input) {
      return {
        purpose: 'lookbook.image',
        target: { kind: 'lookbook', id: input.lookbookId },
        models: [],
      };
    },
    async validateLookbookImageSpec(input) {
      return {
        valid: true,
        spec: input.spec,
        providerPayload: {},
      };
    },
    async createLookbookImageSpec(input) {
      return makeMediaGenerationSpecRecord('media_generation_spec_test0001', input.spec);
    },
    async updateLookbookImageSpec(input) {
      return makeMediaGenerationSpecRecord(input.specId, input.spec);
    },
    async readLookbookImageSpec(input) {
      return makeMediaGenerationSpecRecord(input.specId, makeLookbookImageSpec());
    },
    async listLookbookImageSpecs() {
      return { specs: [] };
    },
    async prepareLookbookImageSpec(input) {
      return {
        spec: makeMediaGenerationSpecRecord(input.specId, makeLookbookImageSpec()),
        providerPayload: {},
        generation: {
          policy: {
            provider: 'fal-ai',
            model: 'nano-banana-2',
            mediaKind: 'image',
            mode: 'text-to-image',
            outputCount: 1,
          },
          request: {
            prompt: 'A Lookbook image.',
            parameters: {},
            outputNames: ['lookbook-image.png'],
          },
        },
      };
    },
    async estimateLookbookImageSpec(input) {
      return {
        spec: makeMediaGenerationSpecRecord(input.specId, makeLookbookImageSpec()),
        providerPayload: {},
        generation: {
          policy: {
            provider: 'fal-ai',
            model: 'nano-banana-2',
            mediaKind: 'image',
            mode: 'text-to-image',
            outputCount: 1,
          },
          request: {
            prompt: 'A Lookbook image.',
            parameters: {},
            outputNames: ['lookbook-image.png'],
          },
        },
        estimate: {
          provider: 'fal-ai',
          model: 'nano-banana-2',
          mediaKind: 'image',
          pricing: 0,
          estimatedCostUsd: 0,
          approvalToken: 'sha256:test',
          billableUnits: { outputCount: 1 },
          warnings: [],
        },
      };
    },
    async runLookbookImageSpec(input) {
      return {
        run: {
          id: 'media_generation_run_test0001',
          specId: input.specId,
          purpose: 'lookbook.image',
          target: { kind: 'lookbook', id: 'lookbook_test0001' },
          modelChoice: 'fal-ai/nano-banana-2',
          provider: 'fal-ai',
          model: 'nano-banana-2',
          specSnapshot: makeLookbookImageSpec(),
          providerPayload: {},
          estimateSnapshot: {
            estimatedCostUsd: 0,
            approvalToken: 'sha256:test',
          },
          simulated: Boolean(input.simulate),
          status: input.simulate ? 'simulated' : 'completed',
          outputs: [],
          diagnostics: {},
          startedAt: '2026-05-22T00:00:00.000Z',
          completedAt: '2026-05-22T00:00:00.000Z',
        },
      };
    },
    async recordLookbookImageRun(input) {
      return {
        run: {
          id: 'media_generation_run_test0001',
          specId: input.specId,
          purpose: 'lookbook.image',
          target: { kind: 'lookbook', id: 'lookbook_test0001' },
          modelChoice: 'fal-ai/nano-banana-2',
          provider: 'fal-ai',
          model: 'nano-banana-2',
          specSnapshot: makeLookbookImageSpec(),
          providerPayload: {},
          estimateSnapshot: {},
          simulated: true,
          status: 'simulated',
          outputs: [],
          diagnostics: {},
          startedAt: '2026-05-22T00:00:00.000Z',
          completedAt: '2026-05-22T00:00:00.000Z',
        },
      };
    },
    async importLookbookImageMedia(input) {
      return {
        valid: true,
        warnings: [],
        project: { name: 'test-project' },
        changes: [{ type: 'lookbook.imageImported', lookbookId: input.lookbookId }],
        purpose: 'lookbook.image',
        target: { kind: 'lookbook', id: input.lookbookId },
        imported: makeLookbookImage('lookbook_image_test0001'),
        resourceKeys: [],
      };
    },
    async buildLookbookSheetContext(input) {
      return {
        purpose: 'lookbook.sheet',
        target: { kind: 'lookbook', id: input.lookbookId },
        project: {
          id: 'project_test',
          name: 'test-project',
          title: project.identity.title,
          aspectRatio: project.identity.aspectRatio ?? null,
        },
        lookbook: makeLookbook(input.lookbookId),
        sourceInspirationFolders: [],
        existingSheets: [makeLookbookSheet('lookbook_sheet_test0001')],
        cardImage: null,
        defaults: {
          takeCount: 1,
          seed: null,
          sheetFrame: 'project',
          resolvedAspectRatio: project.identity.aspectRatio ?? null,
          detail: 'standard',
          outputFormat: 'png',
        },
        resourceKeys: [],
      };
    },
    async listLookbookSheetModels(input) {
      return {
        purpose: 'lookbook.sheet',
        target: { kind: 'lookbook', id: input.lookbookId },
        models: [],
      };
    },
    async validateLookbookSheetSpec(input) {
      return {
        valid: true,
        spec: input.spec,
        providerPayload: {},
      };
    },
    async createLookbookSheetSpec(input) {
      return makeMediaGenerationSpecRecord('media_generation_spec_test0001', input.spec);
    },
    async updateLookbookSheetSpec(input) {
      return makeMediaGenerationSpecRecord(input.specId, input.spec);
    },
    async readLookbookSheetSpec(input) {
      return makeMediaGenerationSpecRecord(input.specId, makeLookbookSheetSpec());
    },
    async listLookbookSheetSpecs() {
      return { specs: [] };
    },
    async prepareLookbookSheetSpec(input) {
      return {
        spec: makeMediaGenerationSpecRecord(input.specId, makeLookbookSheetSpec()),
        providerPayload: {},
        generation: {
          policy: {
            provider: 'fal-ai',
            model: 'nano-banana-2',
            mediaKind: 'image',
            mode: 'text-to-image',
            outputCount: 1,
          },
          request: {
            prompt: 'A Lookbook sheet.',
            parameters: {},
            outputNames: ['lookbook-sheet.png'],
          },
        },
      };
    },
    async estimateLookbookSheetSpec(input) {
      return {
        spec: makeMediaGenerationSpecRecord(input.specId, makeLookbookSheetSpec()),
        providerPayload: {},
        generation: {
          policy: {
            provider: 'fal-ai',
            model: 'nano-banana-2',
            mediaKind: 'image',
            mode: 'text-to-image',
            outputCount: 1,
          },
          request: {
            prompt: 'A Lookbook sheet.',
            parameters: {},
            outputNames: ['lookbook-sheet.png'],
          },
        },
        estimate: {
          provider: 'fal-ai',
          model: 'nano-banana-2',
          mediaKind: 'image',
          pricing: 0,
          estimatedCostUsd: 0,
          approvalToken: 'sha256:test',
          billableUnits: { outputCount: 1 },
          warnings: [],
        },
      };
    },
    async runLookbookSheetSpec(input) {
      return {
        run: {
          id: 'media_generation_run_test0001',
          specId: input.specId,
          purpose: 'lookbook.sheet',
          target: { kind: 'lookbook', id: 'lookbook_test0001' },
          modelChoice: 'fal-ai/nano-banana-2',
          provider: 'fal-ai',
          model: 'nano-banana-2',
          specSnapshot: makeLookbookSheetSpec(),
          providerPayload: {},
          estimateSnapshot: {
            estimatedCostUsd: 0,
            approvalToken: 'sha256:test',
          },
          simulated: Boolean(input.simulate),
          status: input.simulate ? 'simulated' : 'completed',
          outputs: [],
          diagnostics: {},
          startedAt: '2026-05-22T00:00:00.000Z',
          completedAt: '2026-05-22T00:00:00.000Z',
        },
      };
    },
    async recordLookbookSheetRun(input) {
      return {
        run: {
          id: 'media_generation_run_test0001',
          specId: input.specId,
          purpose: 'lookbook.sheet',
          target: { kind: 'lookbook', id: 'lookbook_test0001' },
          modelChoice: 'fal-ai/nano-banana-2',
          provider: 'fal-ai',
          model: 'nano-banana-2',
          specSnapshot: makeLookbookSheetSpec(),
          providerPayload: {},
          estimateSnapshot: {},
          simulated: true,
          status: 'simulated',
          outputs: [],
          diagnostics: {},
          startedAt: '2026-05-22T00:00:00.000Z',
          completedAt: '2026-05-22T00:00:00.000Z',
        },
      };
    },
    async importLookbookSheetMedia(input) {
      return {
        valid: true,
        warnings: [],
        project: { name: 'test-project' },
        changes: [{ type: 'lookbook.sheetImported', lookbookId: input.lookbookId }],
        purpose: 'lookbook.sheet',
        target: { kind: 'lookbook', id: input.lookbookId },
        imported: makeLookbookSheet('lookbook_sheet_test0001'),
        resourceKeys: [],
      };
    },
    async deleteLookbookImage() {
      return makeLookbookImageMutationReport('lookbook_test0001');
    },
    async deleteLookbookSheet() {
      return makeLookbookSheetMutationReport('lookbook_test0001');
    },
    async setDefaultLookbookSheet(input) {
      return makeLookbookSheetMutationReport(
        'lookbook_test0001',
        makeLookbookSheet(input.sheetId)
      );
    },
    async setLookbookImagePlacement(input) {
      return makeLookbookImageMutationReport('lookbook_test0001', {
        ...makeLookbookImage(input.imageId),
        sections: input.sections,
      });
    },
    async createSceneShotVideoTake(input) {
      return makeSceneShotVideoTake({
        sceneId: input.sceneId,
        sourceShotListId: input.shotListId,
        shotIds: input.shotIds,
        title: input.title,
      });
    },
    async readSceneShotVideoTake(input) {
      return makeSceneShotVideoTake({
        takeId: input.takeId,
      });
    },
    async listSceneShotVideoTakes(input) {
      return {
        takes: [
          makeSceneShotVideoTake({
            sceneId: input.sceneId,
          }),
        ],
      };
    },
    async deleteSceneShotVideoTake(input) {
      return makeRecoverableMutationReport({
        changeType: 'sceneShotVideoTake.discarded',
        itemId: input.takeId,
        resourceKeys: [
          `scene:${input.sceneId ?? 'scene_opening'}`,
          `surface:scene:${input.sceneId ?? 'scene_opening'}:takes`,
          `scene-shot-video-take:${input.takeId}`,
        ],
      });
    },
    async updateSceneShotVideoTakePick(input) {
      return {
        take: {
          ...makeSceneShotVideoTake({
            takeId: input.takeId,
            sceneId: input.sceneId,
          }),
          picked: input.picked,
        },
        resourceKeys: [
          `scene:${input.sceneId ?? 'scene_opening'}`,
          `surface:scene:${input.sceneId ?? 'scene_opening'}:takes`,
          `scene-shot-video-take:${input.takeId}`,
        ],
      };
    },
    async buildShotVideoTakeContext(input) {
      return makeShotVideoTakeContext(input);
    },
    async readSceneShotVideoTakeEditContext(input) {
      return makeSceneShotVideoTakeEditContext(input);
    },
    async listShotVideoTakeModels(input) {
      const context = makeShotVideoTakeContext(input);
      return {
        purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
        target: makeShotVideoTakeTarget(input),
        ...(input.inputModeId ? { inputModeId: input.inputModeId } : {}),
        shotGroupMode: context.shotGroupMode,
        defaultModelChoice: 'fal-ai/bytedance/seedance-2.0',
        models: [
          {
            modelChoice: 'fal-ai/bytedance/seedance-2.0',
            label: 'Seedance 2.0',
            available: true,
            supportedInputModes: ['text-only', 'first-frame', 'first-last-frame', 'reference'],
            duration: { supported: true, values: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
            inputRoles: [],
            parameters: [],
            estimateInputs: {
              canEstimateBeforeDependenciesExist: true,
              requiresPreparedInputs: false,
            },
          },
        ],
      };
    },
    async updateSceneShotVideoTakeProduction(input) {
      return makeShotVideoTakeContext(input, input.production);
    },
    async updateSceneShotVideoTakeShotDesign(input) {
      return makeShotVideoTakeContext(input);
    },
    async updateSceneShotVideoTakeShots(input) {
      return makeShotVideoTakeContext(input, undefined, input.shotIds);
    },
    async updateSceneShotVideoTakeCharacterSheetSelection(input) {
      return makeShotVideoTakeContext(input, undefined, undefined, {
        selectedCharacterSheetAssetIds: input.assetId
          ? { [input.castMemberId]: input.assetId }
          : {},
      });
    },
    async updateSceneShotVideoTakeLocationSheetSelection(input) {
      return makeShotVideoTakeContext(input, undefined, undefined, {
        referencedLocationSheetAssetIds: input.assetIds.length
          ? { [input.locationId]: input.assetIds }
          : {},
      });
    },
    async updateSceneShotVideoTakeLookbookSheetSelection(input) {
      return makeShotVideoTakeContext(input, undefined, undefined, {
        selectedLookbookSheetIds: input.lookbookSheetId
          ? [input.lookbookSheetId]
          : [],
      });
    },
    async updateSceneShotVideoTakeDialogueAudioSelection(input) {
      return makeShotVideoTakeContext(input, undefined, undefined, {
        selectedDialogueAudioTakeIds: input.dialogueAudioTakeId
          ? { [input.dialogueId]: input.dialogueAudioTakeId }
          : {},
      });
    },
    async updateSceneShotVideoTakeReferenceInclusion(input) {
      return makeShotVideoTakeContext(input, undefined, undefined, {
        dependencyInclusions: input.inclusion
          ? { [input.dependencyId]: input.inclusion }
          : {},
      });
    },
    async planShotVideoTakeProduction(input) {
      return makeShotVideoTakePlan(input);
    },
    async readShotVideoTakeProductionPlan(input) {
      const target = makeShotVideoTakeTarget(input);
      const plan = makeShotVideoTakePlan(input);
      const take = makeSceneShotVideoTake({
        takeId: input.takeId,
        production: input.production,
      });
      return {
        target,
        take,
        finalPrompt: null,
        plan,
        references: {
          general: [],
          lookbook: [],
          dialogueAudio: [],
          dialogueAudioCapability: {
            state: 'ok',
            supported: false,
            selectedCount: 0,
            maxCount: null,
            modelLabel: 'Seedance 2.0',
            message: 'This model does not use audio references',
            diagnostics: [],
          },
          castMembers: [],
          locations: [],
        },
        diagnostics: plan.diagnostics,
      };
    },
    async estimateShotVideoTakeProduction(input) {
      const target = makeShotVideoTakeTarget(input);
      const plan = makeShotVideoTakePlan(input);
      const take = makeSceneShotVideoTake({
        takeId: input.takeId,
        production: input.production,
      });
      return {
        target,
        take,
        inputModeId: input.production?.inputModeId ?? 'text-only',
        shotGroupMode:
          take.shotIds.length > 1 ? 'multi-shot' : 'single-shot',
        modelChoice:
          input.production?.modelChoice ??
          'fal-ai/bytedance/seedance-2.0',
        estimate: {
          provider: 'fal-ai',
          model: 'fal-ai/bytedance/seedance-2.0',
          mediaKind: 'video',
          pricing: null,
          estimatedCostUsd: 0.42,
          approvalToken: 'fake-approval-token',
          billableUnits: {},
          warnings: [],
        },
        plan,
        issues: [],
      };
    },
    async selectShotVideoTakeInput(input) {
      return makeShotVideoTakeContext(input);
    },
    async clearShotVideoTakeInputSelection(input) {
      return makeShotVideoTakeContext(input);
    },
    async deleteShotVideoTakeInput(input) {
      return makeShotVideoTakeContext(input);
    },
  };
}

function makeShotVideoTakePlan(input: {
  takeId: string;
  production?: SceneShotVideoTakeProductionState;
}): ShotVideoTakeOutputGenerationPlan {
  const target = makeShotVideoTakeTarget(input);
  const take = makeSceneShotVideoTake({
    takeId: input.takeId,
    production: input.production,
  });
  const inputMode = input.production?.inputModeId ?? 'text-only';
  const shotGroupMode =
    take.shotIds.length > 1 ? 'multi-shot' : 'single-shot';
  const modelChoice = input.production?.modelChoice ?? 'fal-ai/bytedance/seedance-2.0';
  return {
    planId: 'shot_video_take_plan_fake',
    request: {
      projectId: 'project_test',
      sceneId: take.sceneId,
      shotListId: take.sourceShotListId,
      takeId: take.takeId,
      inputMode,
      shotGroupMode,
      modelChoice,
      routeSettings: input.production?.parameterValues ?? {},
      inputPolicy: { defaultMode: 'auto' },
    },
    model: {
      choice: modelChoice,
      label: 'Seedance 2.0',
      version: '2.0',
      provider: 'fal-ai',
    },
    route: {
      inputMode,
      shotGroupMode,
      providerModel: 'bytedance/seedance-2.0/text-to-video',
      mode: 'text-to-video',
      inputRoles: [],
      parameters: [],
    },
    dependencyInventory: {
      rootPurpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      rootTarget: target,
      dependencies: [],
      rootGeneration: {
        id: 'root:shot.video-take',
        purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
        target,
        label: 'Final video take',
        mediaKind: 'video',
        pricing: { state: 'priced', estimatedUsd: 0.42 },
        canCreateSpec: true,
        blockedReason: null,
        estimate: null,
        diagnostics: [],
      },
      estimate: {
        state: 'complete',
        estimatedTotalUsd: 0.42,
        pricedDependencyCount: 1,
        unpricedDependencyCount: 0,
        unavailableDependencyCount: 0,
        requiresPriceOverride: false,
      },
      diagnostics: [],
      agentChecklist: [],
    },
    lines: [
      {
        id: 'line:root:shot.video-take',
        dependencyLineId: 'root:shot.video-take',
        kind: 'final-video-generation',
        label: 'Final video take',
        purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
        mediaKind: 'video',
        depth: 0,
        state: 'planned',
        materializationState: 'generatable',
        pricing: { state: 'priced', estimatedUsd: 0.42 },
        required: true,
        diagnostics: [],
      },
    ],
    estimate: {
      state: 'complete',
      estimatedTotalUsd: 0.42,
      pricedLineCount: 1,
      unpricedLineCount: 0,
      missingLineCount: 0,
      requiresPriceOverride: false,
    },
    diagnostics: [],
    finalEstimate: {
      provider: 'fal-ai',
      model: 'bytedance/seedance-2.0/text-to-video',
      mediaKind: 'video',
      pricing: null,
      estimatedCostUsd: 0.42,
      approvalToken: 'fake-approval-token',
      billableUnits: {},
      warnings: [],
    },
  };
}

function makeShotVideoTakeTarget(input: {
  takeId: string;
}) {
  const take = makeSceneShotVideoTake({
    takeId: input.takeId,
  });
  return {
    kind: 'sceneShotVideoTake' as const,
    id: take.takeId,
    sceneId: take.sceneId,
    sourceShotListId: take.sourceShotListId,
    takeId: take.takeId,
    shotIds: take.shotIds,
  };
}

function makeShotVideoTakeContext(
  input: {
    takeId: string;
  },
  production?: SceneShotVideoTakeProductionState,
  shotIds?: string[],
  referenceSelections?: Partial<
    SceneShotVideoTake['state']['referenceSelections']
  >
): ShotVideoTakeProductionContext {
  const take = makeSceneShotVideoTake({
    takeId: input.takeId,
    shotIds,
    referenceSelections,
  });
  const target = makeShotVideoTakeTarget(input);
  return {
    purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
    target,
    project: {
      name: 'test-project',
      title: 'Test Project',
      aspectRatio: '16:9',
    },
    scene: {
      id: take.sceneId,
      title: 'Opening Scene',
      setting: { locationIds: [] },
      storyFunction: [],
    },
    shotList: {
      id: take.sourceShotListId,
      title: 'Opening coverage',
      summary: 'Coverage summary.',
      createdAt: '2026-05-22T00:00:00.000Z',
      updatedAt: '2026-05-22T00:00:00.000Z',
      isActive: true,
    },
    take,
    shotGroupMode: take.shotIds.length > 1 ? 'multi-shot' : 'single-shot',
    shots: [],
    displayShots: [],
    referencedCast: [],
    referencedLocations: [],
    activeLookbook: null,
    storyboardImages: [],
    mediaInputs: [],
    outputs: [],
    defaults: {
      inputModeId: 'text-only',
      imageDependencyModelChoice: 'fal-ai/nano-banana-2',
      parameterValues: {},
    },
    resourceKeys: [
      `surface:scene:${take.sceneId}:takes`,
      `scene-shot-video-take:${take.takeId}`,
    ],
  };
}

function makeSceneShotVideoTakeEditContext(input: {
  takeId: string;
}): SceneShotVideoTakeEditContext {
  const context = makeShotVideoTakeContext(input);
  return {
    purpose: context.purpose,
    target: context.target,
    project: context.project,
    scene: context.scene,
    take: context.take,
    sourceShotList: context.shotList,
    sourceShots: context.shots,
    displayShots: context.displayShots,
    shotGroupMode: context.shotGroupMode,
    referencedCast: context.referencedCast,
    referencedLocations: context.referencedLocations,
    activeLookbook: context.activeLookbook,
    storyboardImages: context.storyboardImages,
    mediaInputs: context.mediaInputs,
    outputs: context.outputs,
    assetReadiness: {
      selectedInputCount: 0,
      readyInputCount: 0,
      missingInputCount: 0,
      diagnostics: [],
    },
    defaults: context.defaults,
    resourceKeys: context.resourceKeys,
  };
}

function makeSceneShotVideoTake(
  input: {
    takeId?: string;
    sceneId?: string;
    sourceShotListId?: string;
    shotIds?: string[];
    title?: string;
    production?: SceneShotVideoTakeProductionState;
    referenceSelections?: Partial<SceneShotVideoTake['state']['referenceSelections']>;
  } = {}
): SceneShotVideoTake {
  const shotIds = input.shotIds ?? ['shot_001'];
  return {
    takeId:
      input.takeId ?? 'scene_shot_video_take_001',
    sceneId: input.sceneId ?? 'scene_opening',
    sourceShotListId: input.sourceShotListId ?? 'shot_list_opening',
    title: input.title ?? 'Opening take',
    shotIds,
    picked: false,
    state: {
      version: 1,
      shotDesignByShotId: {},
      referenceSelections: {
        dependencyInclusions: {},
        selectedCharacterSheetAssetIds: {},
        referencedLocationSheetAssetIds: {},
        selectedLookbookSheetIds: [],
        selectedDialogueAudioTakeIds: {},
        ...input.referenceSelections,
      },
      production: input.production ?? {},
    },
    status: {
      editability: {
        state: 'editable',
        diagnostics: [],
        message: 'This take is editable.',
      },
      resolvability: {
        state: 'resolvable',
        diagnostics: [],
        message: 'All tracked take references resolve.',
      },
      runnability: {
        state: 'not-evaluated',
        diagnostics: [],
        message: 'Run readiness is evaluated by shot-video preflight.',
      },
      archive: { state: 'active', message: 'This take is active.' },
      history: { differences: [], message: 'This take matches its recorded history snapshot.' },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeLookbookImageSpec() {
  return {
    purpose: 'lookbook.image' as const,
    target: { kind: 'lookbook' as const, id: 'lookbook_test0001' },
    modelChoice: 'fal-ai/nano-banana-2' as const,
    prompt: 'A Lookbook image.',
    focusSections: ['palette'] as LookbookSection[],
    takeCount: 1,
    seed: null,
    imageFrame: 'project' as const,
    detail: 'standard' as const,
    outputFormat: 'png' as const,
  };
}

function makeLookbookSheetSpec() {
  return {
    purpose: 'lookbook.sheet' as const,
    target: { kind: 'lookbook' as const, id: 'lookbook_test0001' },
    modelChoice: 'fal-ai/nano-banana-2' as const,
    prompt: 'A Lookbook sheet.',
    takeCount: 1,
    seed: null,
    sheetFrame: 'project' as const,
    detail: 'standard' as const,
    outputFormat: 'png' as const,
  };
}

function makeSceneDialogueAudioContext(
  project: ReturnType<typeof makeProject>
): SceneDialogueAudioContext {
  return {
    purpose: 'scene.dialogue-audio',
    target: { kind: 'scene', sceneId: 'scene_opening' },
    project: {
      name: project.identity.name,
      title: project.identity.title,
      baseLanguageCode: null,
    },
    scene: {
      id: 'scene_opening',
      title: 'Opening Scene',
      settingLabel: null,
    },
    dialogues: [],
    castMemberLabels: {},
    castVoicesByCastMemberId: {},
    audioByDialogueId: {},
    models: [],
    defaults: {
      modelChoice: 'elevenlabs/eleven_v3',
      outputFormat: 'mp3_44100_128',
      languageCode: null,
      voiceSettings: {},
    },
    resourceKeys: [],
  };
}

function makeMediaGenerationSpecRecord(
  id: string,
  spec: MediaGenerationSpec
): MediaGenerationSpecRecord {
  return {
    id,
    purpose: spec.purpose,
    target: spec.target,
    modelChoice: spec.modelChoice,
    title: 'title' in spec && spec.title ? spec.title : 'Media generation',
    spec,
    createdAt: '2026-05-22T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
  };
}

function makeLookbook(id: string, name = 'Lookbook') {
  return {
    id,
    name,
    type: 'movie' as const,
    definition: {
      thesis: {
        statement: 'The movie favors pressure over spectacle.',
        principles: ['Use negative space as pressure.'],
      },
      palette: {
        description: 'Steel and ember tones.',
        colors: [{ hex: '#334455', name: 'Siege steel', meaning: 'Pressure.' }],
        observations: [{ text: 'Warmth appears near human labor.' }],
      },
      toneMood: {
        tone: 'controlled dread',
        moodTags: ['tense'],
        description: 'Held shadows and practical highlights.',
      },
      composition: {
        description: 'Orderly compositions tighten around decisions.',
        patterns: [{ name: 'Map pressure', description: 'Tables compress depth.' }],
      },
      lighting: {
        description: 'Practical pools of warm light.',
        patterns: [{ name: 'Lamp islands', description: 'Oil lamps isolate faces.' }],
      },
      texture: {
        description: 'Stone, smoke, and worn metal.',
        observations: [{ text: 'Fine surface texture stays visible.' }],
      },
      camera: {
        description: 'Patient and observant.',
        movement: [{ name: 'Slow push', description: 'Push in when decisions harden.' }],
        motion: [{ name: 'Held labor', description: 'Blocking moves with weight.' }],
        framing: [{ name: 'Measured distance', description: 'Close-ups are earned.' }],
      },
    },
  };
}

function makeLookbookImage(id: string) {
  return {
    id,
    lookbookId: 'lookbook_test0001',
    lookbookType: 'movie' as const,
    asset: {
      assetId: 'asset_lookbook_image',
      type: 'lookbook_image',
      mediaKind: 'image',
      title: 'Lookbook image',
      origin: 'generated',
      availability: 'ready',
      files: [],
      createdAt: '2026-05-22T00:00:00.000Z',
      updatedAt: '2026-05-22T00:00:00.000Z',
    },
    sections: [] as LookbookSection[],
  };
}

function makeLookbookSheet(id: string) {
  return {
    id,
    lookbookId: 'lookbook_test0001',
    lookbookType: 'movie' as const,
    asset: {
      assetId: 'asset_lookbook_sheet',
      type: 'lookbook_sheet',
      mediaKind: 'image',
      title: 'Lookbook sheet',
      origin: 'generated',
      availability: 'ready',
      files: [
        {
          id: 'asset_file_lookbook_sheet',
          role: 'source',
          projectRelativePath:
            'generated/media/lookbook-sheet.png' as ProjectRelativePath,
          mediaKind: 'image',
          mimeType: 'image/png',
          sizeBytes: 1024,
          contentHash: 'sha256:lookbook-sheet',
          width: 1024,
          height: 768,
          durationSeconds: null,
        },
      ],
      createdAt: '2026-05-22T00:00:00.000Z',
      updatedAt: '2026-05-22T00:00:00.000Z',
    },
  };
}

function makeVisualLanguageCommandReport(type: string) {
  return {
    valid: true as const,
    warnings: [],
    project: { name: 'test-project' },
    changes: [{ type }],
    resourceKeys: [],
  };
}

function makeRecoverableMutationReport(input: {
  changeType: string;
  itemId: string;
  resourceKeys: string[];
}) {
  return {
    valid: true as const,
    warnings: [],
    project: {
      id: 'project_test0001',
      name: 'constantinople',
    },
    changes: [{ type: input.changeType, itemId: input.itemId }],
    recovery: {
      operationId: 'trash_operation_test0001',
      trashItemIds: ['trash_item_test0001'],
      restorable: true,
      restoreCommand: {
        name: 'trash.restore' as const,
        trashItemId: 'trash_item_test0001',
      },
    },
    resourceKeys: input.resourceKeys,
  };
}

function makeLookbookWriteReport(input: { lookbook: ReturnType<typeof makeLookbook> }) {
  return {
    ...makeVisualLanguageCommandReport('lookbook.updated'),
    lookbook: input.lookbook,
    sourceInspirationFolders: [],
  };
}

function makeLookbookImageMutationReport(
  lookbookId: string,
  image?: ReturnType<typeof makeLookbookImage>
) {
  return {
    ...makeVisualLanguageCommandReport('lookbook.imageChanged'),
    lookbookId,
    ...(image ? { image } : {}),
  };
}

function makeLookbookSheetMutationReport(
  lookbookId: string,
  sheet?: ReturnType<typeof makeLookbookSheet>
) {
  return {
    ...makeVisualLanguageCommandReport('lookbook.sheetChanged'),
    lookbookId,
    ...(sheet ? { sheet } : {}),
  };
}
