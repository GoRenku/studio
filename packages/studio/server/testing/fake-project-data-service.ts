import type {
  LookbookImageGenerationSpec,
  LookbookSection,
  MediaGenerationSpecRecord,
  ProjectLibrary,
} from '@gorenku/studio-core/client';
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
    async listAssets() {
      return [makeAsset('asset_cast_reference')];
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
      return { castMember: project.cast[0] };
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
        locationLabels: {},
        castMemberHandles: {},
        locationHandles: {},
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
        activeShotList: null,
        storyboardSheet: null,
        storyboardImagesByShotId: {},
        castMemberLabels: {},
        locationLabels: {},
      };
    },
    async updateSceneShotCameraDesign() {
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
        activeShotList: null,
        storyboardSheet: null,
        storyboardImagesByShotId: {},
        castMemberLabels: {},
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
    async deleteAsset() {
      return undefined;
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
        id: 'inspiration_folder_test0001',
        name: input.name,
        projectRelativePath: 'visual-language/inspiration/reference' as never,
      };
    },
    async renameInspirationFolder(input) {
      return {
        id: input.folderId,
        name: input.name,
        projectRelativePath: 'visual-language/inspiration/reference' as never,
      };
    },
    async reorderInspirationFolders() {
      return { items: [], nextCursor: null };
    },
    async deleteInspirationFolder() {},
    async writeInspirationImage() {
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
    async deleteInspirationImage() {
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
        activeLookbookId: null,
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
        isActive: false,
        images: [],
        imagesBySection: {
          thesis: [],
          palette: [],
          tone_mood: [],
          composition: [],
          lighting: [],
          texture: [],
          camera: [],
        },
        resourceKeys: [],
      };
    },
    async createLookbook(input) {
      return makeLookbookWriteReport({
        lookbook: {
          id: 'lookbook_test0001',
          ...input.document.lookbook,
          name: input.name,
        },
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
    async setActiveLookbook() {
      return makeVisualLanguageCommandReport('lookbook.activeSet');
    },
    async clearActiveLookbook() {
      return makeVisualLanguageCommandReport('lookbook.activeCleared');
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
          tone_mood: [],
          composition: [],
          lighting: [],
          texture: [],
          camera: [],
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
    async deleteLookbookImage() {
      return makeLookbookImageMutationReport('lookbook_test0001');
    },
    async setLookbookImageSections(input) {
      return makeLookbookImageMutationReport('lookbook_test0001', {
        ...makeLookbookImage(input.imageId),
        sections: input.sections,
      });
    },
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

function makeMediaGenerationSpecRecord(
  id: string,
  spec: LookbookImageGenerationSpec
): MediaGenerationSpecRecord {
  return {
    id,
    purpose: 'lookbook.image' as const,
    target: spec.target,
    modelChoice: spec.modelChoice,
    title: 'Lookbook image',
    spec,
    createdAt: '2026-05-22T00:00:00.000Z',
    updatedAt: '2026-05-22T00:00:00.000Z',
  };
}

function makeLookbook(id: string, name = 'Lookbook') {
  return {
    id,
    name,
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
  };
}

function makeLookbookImage(id: string) {
  return {
    id,
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

function makeVisualLanguageCommandReport(type: string) {
  return {
    valid: true as const,
    warnings: [],
    project: { name: 'test-project' },
    changes: [{ type }],
    resourceKeys: [],
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
