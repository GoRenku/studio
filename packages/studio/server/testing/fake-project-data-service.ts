import type { ProjectLibrary } from '@gorenku/studio-core/client';
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
        absolutePath: '/tmp/renku/constantinople/working-assets/base/cast/reference.png',
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
    async listSequenceNavigation() {
      return makeProjectShell(project).navigation.screenplay.sequences;
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
        },
        sequence: {
          id: 'seq_opening',
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
    async createAssetSelect(input) {
      return {
        ...makeAsset(input.assetId),
        selection: { kind: 'select', order: 1 },
      };
    },
    async removeAssetSelect(input) {
      return makeAsset(input.assetId);
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
  };
}
