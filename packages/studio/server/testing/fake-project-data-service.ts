import type {
  GenerationPreviewResourceData,
  LookbookSection,
  Lookbook,
  LookbookResource,
  ProductionLookbook,
  StoryboardLookbook,
  ProjectRelativePath,
  ProjectLibrary,
  SceneDialogueAudioWorkspace,
  ProjectSettingsDocument,
} from '@gorenku/studio-core/client';
import { DEFAULT_PROJECT_SETTINGS } from '@gorenku/studio-core/server';
import type { CreateProjectsRouteOptions } from '../routes/projects.js';
import {
  fixtureCastMember,
  fixtureScreenplay,
  makeAsset,
  makeProject,
  makeProjectShell,
} from './route-fixtures.js';

export function fakeProjectDataService(): NonNullable<
  CreateProjectsRouteOptions['projectData']
> {
  const project = makeProject();
  const library: ProjectLibrary = {
    storageRoot: '/tmp/renku',
    projects: [
      {
        projectName: project.projectName,
        title: project.title,
        folderPath: '/tmp/renku/constantinople',
        coverImage: project.coverImage,
        counts: project.counts,
        validationError: null,
      },
    ],
  };

  return {
    async createMovieProject(input) {
      return {
        projectName: input.projectName,
        projectPath: `/tmp/renku/${input.projectName}`,
        databasePath: `/tmp/renku/${input.projectName}/.renku/project.sqlite`,
        coverPath: null,
        created: {
          languages: 1,
          castMembers: 0,
          locations: 0,
          props: 0,
          acts: 0,
          sequences: 0,
          scenes: 0,
        },
        warnings: [],
      };
    },
    async deleteProject(input) {
      return {
        projectName: input.projectName,
        projectPath: `/tmp/renku/${input.projectName}`,
        deleted: true,
      };
    },
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
        title: project.title,
        aspectRatio: project.aspectRatio,
        logline: project.logline,
        languages: makeProjectShell(project).languages,
      };
    },
    async readProjectSettings() {
      return projectSettingsResource(project.id, project.projectName);
    },
    async replaceProjectSettings(input) {
      return {
        resource: {
          project: { id: project.id, name: project.projectName },
          settings: input.settings as ProjectSettingsDocument,
        },
        resourceKeys: ['project-settings'],
      };
    },
    async patchProjectInformation() {
      return {
        title: project.title,
        aspectRatio: project.aspectRatio,
        logline: project.logline,
        languages: makeProjectShell(project).languages,
      };
    },
    async resolveCoverImage() {
      return '/tmp/renku/constantinople/cover.png';
    },
    async resolveProjectAssetFileById(input) {
      const asset = makeAsset(input.assetId);
      return {
        assetId: asset.id,
        assetMediaKind: asset.mediaKind,
        file: {
          ...asset.files[0],
          id: input.assetFileId,
        },
        absolutePath: '/tmp/renku/constantinople/cast/reference.png',
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
          id: project.id,
          projectName: project.projectName,
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
        resourceKeys: [`surface:castMember:${input.castMemberId}`],
      };
    },
    async listAssetPage() {
      return {
        items: [makeAsset('asset_cast_reference')],
        nextCursor: null,
        selectedAssetId: null,
      };
    },
    async listSceneShotPlans(input) {
      return {
        valid: true,
        project: {
          id: project.id,
          projectName: project.projectName,
          projectFolder: '/tmp/renku/constantinople',
        },
        shotPlans: [],
        warnings: [],
        resourceKeys: [`surface:scene:${input.sceneId}:shot-plans`],
      };
    },
    async listSceneShotPlanVideoGenerations(input) {
      return {
        sceneId: input.sceneId,
        groups: [],
        resourceKeys: [
          `surface:scene:${input.sceneId}:video-generations`,
        ],
      };
    },
    async readShotPlan() {
      throw new Error('Shot Plan fixture was not configured.');
    },
    async deleteShotPlan() {
      throw new Error('Shot Plan deletion fixture was not configured.');
    },
    async listCastNavigation() {
      return makeProjectShell(project).navigation.cast;
    },
    async listLocationNavigation() {
      return makeProjectShell(project).navigation.locations;
    },
    async readSceneDesignResource() {
      return {
        scene: {
          scene: fixtureScreenplay.scenes[0]!,
          references: [],
        },
        assetPage: { items: [], nextCursor: null, selectedAssetId: null },
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
      return { castMember: fixtureCastMember, voices: [] };
    },
    async updateCastMemberVoiceOverStatus() {
      return fixtureCastMember;
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
    async readPropOverviewResource() {
      return { props: makeProjectShell(project).navigation.props };
    },
    async readPropResource() {
      return {
        prop: {
          id: 'prop_test',
          handle: 'prop-test',
          name: 'Prop',
        },
      };
    },
    async readStoryArcResource() {
      return {
        project: { title: project.title },
        scenes: fixtureScreenplay.scenes.map(({ id, productionNumber, heading, title }) => ({
          id,
          productionNumber,
          heading,
          title,
        })),
        activeAnalysis: null,
      };
    },
    async readScreenplayStructure() {
      return {
        screenplay: fixtureScreenplay,
        orderedSceneIds: ['scene_opening'],
      };
    },
    async readScreenplaySection() {
      return {
        section: fixtureScreenplay.sections[0]!,
        structure: fixtureScreenplay.structure,
        orderedSceneIds: ['scene_opening'],
      };
    },
    async readScreenplayScene() {
      return {
        scene: fixtureScreenplay.scenes[0]!,
        references: [],
      };
    },
    async readSceneDialogueAudioWorkspace() {
      return makeSceneDialogueAudioWorkspace(project);
    },
    async estimateSceneDialogueAudioDraft(input) {
      return {
        provider: 'elevenlabs',
        model: input.estimate.modelChoice.replace('elevenlabs/', ''),
        estimatedCostUsd: 0.01,
        billableUnits: { characterCount: input.estimate.text.length },
      };
    },
    async updateSceneDialogueAudioSetup() {
      return {
        context: makeSceneDialogueAudioWorkspace(project),
        resourceKeys: [],
      };
    },
    async generateSceneDialogueAudioTake() {
      return {
        context: makeSceneDialogueAudioWorkspace(project),
        resourceKeys: [],
      };
    },
    async deleteSceneDialogueAudioTake() {
      return {
        context: makeSceneDialogueAudioWorkspace(project),
        resourceKeys: [],
      };
    },
    async readSceneBeatsResource() {
      return {
        scene: {
          scene: fixtureScreenplay.scenes[0]!,
          references: [],
        },
        sections: fixtureScreenplay.sections,
        projectAspectRatio: '16:9',
        activeRevisionId: 'scene_beats_revision_opening',
        activeRevision: null,
        storyboardImagesByBeatId: {},
        castMemberLabels: {},
        castMemberImages: {},
        locationLabels: {},
        propLabels: {},
      };
    },
    async selectAsset(input) {
      return {
        valid: true,
        warnings: [],
        project: {
          id: project.id,
          projectName: project.projectName,
          projectFolder: '/tmp/renku/constantinople',
        },
        target: input.target,
        selectedAssetId: input.assetId,
        resourceKeys: [],
      };
    },
    async clearAssetSelection(input) {
      return {
        valid: true,
        warnings: [],
        project: {
          id: project.id,
          projectName: project.projectName,
          projectFolder: '/tmp/renku/constantinople',
        },
        target: input.target,
        selectedAssetId: null,
        resourceKeys: [],
      };
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
        project: { id: project.id, projectName: project.projectName },
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
        project: { id: project.id, projectName: project.projectName },
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
        project: { id: project.id, projectName: project.projectName },
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
        project: { projectName: 'test-project' },
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
        project: { projectName: 'test-project' },
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
        project: { projectName: 'test-project' },
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
    async readProjectLookbooks() {
      const production = makeLookbookResource('production');
      return {
        valid: true,
        warnings: [],
        project: { projectName: 'test-project' },
        production,
        storyboard: null,
        resourceKeys: [],
      };
    },
    async readProductionLookbook() {
      return makeLookbookResource('production');
    },
    async readStoryboardLookbook() {
      return makeLookbookResource('storyboard');
    },
    async writeProductionLookbook() {
      return makeLookbookWriteReport({
        lookbook: makeLookbook('lookbook_test0001'),
      });
    },
    async writeStoryboardLookbook() {
      return makeLookbookWriteReport({
        lookbook: makeStoryboardLookbook('lookbook_storyboard_test0001'),
      });
    },
    async validateProductionLookbook() {
      return {
        valid: true,
        warnings: [],
        project: { projectName: 'test-project' },
        sourceInspirationFolders: [],
        resourceKeys: [],
      };
    },
    async validateStoryboardLookbook() {
      return {
        valid: true,
        warnings: [],
        project: { projectName: 'test-project' },
        sourceInspirationFolders: [],
        resourceKeys: [],
      };
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
        project: { projectName: 'test-project' },
        lookbookId: input.lookbookId,
        sourceInspirationFolders: [],
        resourceKeys: [],
      };
    },
    async attachGenerationMedia(input) {
      const asset = makeAsset('asset_generated');
      return {
        valid: true,
        purpose: input.purpose,
        target: input.target,
        asset,
        provenance: null,
        resourceKeys: [],
        project: {
          projectName: project.projectName,
          id: project.id,
          projectFolder: '/tmp/renku/constantinople',
        },
      };
    },
    async deleteLookbookImage() {
      return makeLookbookImageMutationReport('lookbook_test0001');
    },
    async deleteLookbookSheet() {
      return makeLookbookSheetMutationReport('lookbook_test0001');
    },
    async setLookbookImagePlacement(input) {
      return makeLookbookImageMutationReport('lookbook_test0001', {
        ...makeLookbookImage(input.imageId),
        sections: input.sections,
      });
    },
    async listGenerationReferences() {
      return { items: [], nextCursor: null };
    },
  };
}

function projectSettingsResource(id: string, name: string) {
  return {
    project: { id, name },
    settings: structuredClone(DEFAULT_PROJECT_SETTINGS),
  };
}

function makeSceneDialogueAudioWorkspace(
  project: ReturnType<typeof makeProject>
): SceneDialogueAudioWorkspace {
  return {
    purpose: 'scene.dialogue-audio',
    target: { kind: 'scene', sceneId: 'scene_opening' },
    project: {
      projectName: project.projectName,
      title: project.title,
      baseLanguageCode: null,
    },
    scene: {
      id: 'scene_opening',
      heading: 'EXT. THEODOSIAN WALLS - DAWN',
      title: 'Opening Scene',
    },
    dialogues: [],
    castMemberLabels: {},
    castVoicesByCastMemberId: {},
    audioByTurnId: {},
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

function makeLookbook(id: string, name = 'Lookbook') {
  return {
    id,
    name,
    kind: 'production' as const,
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

function makeStoryboardLookbook(id: string, name = 'Storyboard Lookbook') {
  return {
    id,
    name,
    kind: 'storyboard' as const,
    definition: {
      styleBrief: { text: 'Graphite boards with clear staging.' },
      lineAndFinish: { text: 'Loose construction under crisp accents.' },
      valueAndAccent: { text: 'Soft values with restrained warmth.' },
      guardrails: { text: 'Keep action and silhouettes legible.' },
    },
  };
}

function makeLookbookResource(kind: 'production'): LookbookResource & { lookbook: ProductionLookbook };
function makeLookbookResource(kind: 'storyboard'): LookbookResource & { lookbook: StoryboardLookbook };
function makeLookbookResource(kind: 'production' | 'storyboard'): LookbookResource {
  const lookbook = kind === 'production'
    ? makeLookbook('lookbook_test0001')
    : makeStoryboardLookbook('lookbook_storyboard_test0001');
  return {
    valid: true as const,
    warnings: [],
    project: { projectName: 'test-project' },
    lookbook,
    sourceInspirationFolders: [],
    selectedImageId: null,
    images: [],
    sheets: kind === 'production' ? [makeLookbookSheet('lookbook_sheet_test0001')] : [],
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
}

function makeLookbookImage(id: string) {
  return {
    id,
    lookbookId: 'lookbook_test0001',
    lookbookKind: 'production' as const,
    asset: {
      ...makeAsset('asset_lookbook_image'),
      owner: { kind: 'lookbook' as const, id: 'lookbook_test0001' },
      type: 'lookbook_image',
      title: 'Lookbook image',
      files: [],
    },
    sections: [] as LookbookSection[],
  };
}

function makeLookbookSheet(id: string) {
  return {
    id,
    lookbookId: 'lookbook_test0001',
    lookbookKind: 'production' as const,
    asset: {
      ...makeAsset('asset_lookbook_sheet'),
      owner: { kind: 'lookbook' as const, id: 'lookbook_test0001' },
      type: 'lookbook_sheet',
      title: 'Lookbook sheet',
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
    },
  };
}

function makeVisualLanguageCommandReport(type: string) {
  return {
    valid: true as const,
    warnings: [],
    project: { projectName: 'test-project' },
    changes: [{ type }],
    resourceKeys: [],
  };
}

function generationPreviewResource(): GenerationPreviewResourceData {
  return {
    kind: 'generationPreview',
    previewId: 'generation_preview_test',
    generationSpec: { id: 'media_generation_spec_test', frozenAt: null },
    purpose: 'cast.character-sheet',
    project: {
      id: 'project_test0001',
      projectName: 'constantinople',
    },
    target: { kind: 'castMember', id: 'cast_narrator' },
    title: 'Narrator Character Sheet',
    subject: {
      projectLabel: 'Constantinople',
      castMemberLabel: 'Narrator',
    },
    model: {
      provider: 'fal-ai',
      modelId: 'openai/gpt-image-2/edit',
      mediaKind: 'image',
      executionPath: 'renku-managed',
    },
    finalPrompt: {
      authoredText: 'Create a lean character sheet.',
      providerText: 'Create a lean character sheet.',
    },
    references: { slots: [], additional: [] },
    configuration: { sections: [] },
    authoring: { kind: 'image', selectedModelFamilyId: '', modelFamilies: [], controls: [] },
    diagnostics: [],
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
      projectName: 'constantinople',
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

function makeLookbookWriteReport(input: { lookbook: Lookbook }) {
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

export function fakeGenerationPreviewCommands() {
  return {
    async updateGenerationPreviewResource() {
      return generationPreviewResource();
    },
  };
}
