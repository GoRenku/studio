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
    async resolveProjectAssetFileById(input) {
      const asset = makeAsset(input.assetId);
      return {
        assetId: asset.assetId,
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
        resourceKeys: [`surface:castMember:${input.castMemberId}`],
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
        assetPage: { items: [], nextCursor: null },
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
        dialogueAudio: makeSceneDialogueAudioWorkspace(project),
      };
    },
    async readSceneDialogueAudioWorkspace() {
      return makeSceneDialogueAudioWorkspace(project);
    },
    async estimateSceneDialogueAudioDraft(input) {
      return {
        spec: {
          purpose: input.spec.purpose,
          target: { kind: 'sceneDialogue', id: input.spec.target.dialogueId },
          model: {
            provider: 'elevenlabs',
            model: input.spec.modelChoice.replace('elevenlabs/', ''),
          },
          values: {
            text: input.spec.plainText,
            voiceId: input.spec.castVoiceId,
          },
          references: [],
          title: input.spec.title,
        },
        estimate: {
          provider: 'elevenlabs',
          model: 'eleven_v3',
          estimatedCostUsd: 0.01,
          approvalToken: 'approval-token',
          billableUnits: {},
        },
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
    async readSceneBeatSheetResource() {
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
        activeBeatSheetId: 'scene_beat_sheet_opening',
        activeBeatSheet: null,
        storyboardImagesByBeatId: {},
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
    async setCastProfileDisplayAsset(input) {
      return {
        valid: true,
        warnings: [],
        project: {
          id: project.identity.id,
          name: project.identity.name,
          projectFolder: project.identity.folderPath,
        },
        asset: makeAsset(input.assetId),
        resourceKeys: [`surface:castMember:${input.castMemberId}`],
      };
    },
    async clearCastProfileDisplayAsset(input) {
      return {
        valid: true,
        warnings: [],
        project: {
          id: project.identity.id,
          name: project.identity.name,
          projectFolder: project.identity.folderPath,
        },
        asset: null,
        resourceKeys: [`surface:castMember:${input.castMemberId}`],
      };
    },
    async setLocationHeroDisplayAsset(input) {
      return {
        valid: true,
        warnings: [],
        project: {
          id: project.identity.id,
          name: project.identity.name,
          projectFolder: project.identity.folderPath,
        },
        asset: makeAsset(input.assetId),
        resourceKeys: [`surface:location:${input.locationId}`],
      };
    },
    async clearLocationHeroDisplayAsset(input) {
      return {
        valid: true,
        warnings: [],
        project: {
          id: project.identity.id,
          name: project.identity.name,
          projectFolder: project.identity.folderPath,
        },
        asset: null,
        resourceKeys: [`surface:location:${input.locationId}`],
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
    async readProjectLookbooks() {
      const production = makeLookbookResource('production');
      return {
        valid: true,
        warnings: [],
        project: { name: 'test-project' },
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
        project: { name: 'test-project' },
        sourceInspirationFolders: [],
        resourceKeys: [],
      };
    },
    async validateStoryboardLookbook() {
      return {
        valid: true,
        warnings: [],
        project: { name: 'test-project' },
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
          name: project.identity.name,
          id: project.identity.id,
          projectFolder: project.identity.folderPath,
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

function makeSceneDialogueAudioWorkspace(
  project: ReturnType<typeof makeProject>
): SceneDialogueAudioWorkspace {
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
    project: { name: 'test-project' },
    lookbook,
    sourceInspirationFolders: [],
    cardImage: null,
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
    lookbookKind: 'production' as const,
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

function generationPreviewResource(): GenerationPreviewResourceData {
  return {
    kind: 'generationPreview',
    previewId: 'generation_preview_test',
    generationSpecId: 'media_generation_spec_test',
    purpose: 'cast.character-sheet',
    project: {
      id: 'project_test0001',
      name: 'constantinople',
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
    authoring: { models: [] },
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
