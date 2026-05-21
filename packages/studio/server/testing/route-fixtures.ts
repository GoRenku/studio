import type {
  Asset,
  Project,
  ProjectShell,
} from '@gorenku/studio-core/client';

export function makeAsset(assetId: string): Asset {
  return {
    assetId,
    relationshipId: 'cast_asset_test0001',
    target: { kind: 'castMember', castMemberId: 'cast_narrator' },
    localeId: null,
    type: 'reference',
    selection: { kind: 'take' },
    availability: 'ready',
    mediaKind: 'image',
    title: 'Narrator reference',
    oneLineSummary: null,
    origin: 'imported',
    role: 'reference',
    sortOrder: 1,
    files: [
      {
        id: 'asset_file_cast_reference',
        role: 'primary',
        projectRelativePath:
          'working-assets/base/cast/narrator/reference.png' as Asset['files'][number]['projectRelativePath'],
        mediaKind: 'image',
        mimeType: 'image/png',
        sizeBytes: 12,
        contentHash: null,
        width: null,
        height: null,
        durationSeconds: null,
      },
    ],
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z',
  };
}

export function makeProjectShell(project: Project): ProjectShell {
  return {
    identity: project.identity,
    coverImage: project.coverImage,
    languages: project.languages,
    visualLanguageCategories: project.visualLanguageCategories,
    visualLanguage: project.visualLanguage,
    cast: project.cast,
    continuityReferences: project.continuityReferences,
    counts: project.counts,
    navigation: {
      cast: {
        items: project.cast.map((castMember) => ({
          id: castMember.id,
          name: castMember.name,
          kind: castMember.kind,
          role: castMember.role,
        })),
        nextCursor: null,
      },
      visualLanguage: { items: [], nextCursor: null },
      continuityReferences: { items: [], nextCursor: null },
      screenplay: {
        projectType: 'standaloneMovie',
        sequences: {
          items: project.sequences.map((sequence) => ({
            id: sequence.id,
            number: sequence.number,
            title: sequence.title,
            shortTitle: sequence.shortTitle,
            sceneCount: sequence.scenes.length,
            clipCount: sequence.scenes.reduce(
              (count, scene) => count + scene.clips.length,
              0
            ),
          })),
          nextCursor: null,
        },
      },
    },
  };
}

export function makeProject(): Project {
  return {
    identity: {
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
      type: 'standaloneMovie',
      folderPath: '/tmp/renku/constantinople',
      databasePath: '/tmp/renku/constantinople/.renku/project.sqlite',
    },
    coverImage: { fileName: 'cover.png' },
    languages: [],
    visualLanguageCategories: [],
    visualLanguage: [],
    cast: [
      {
        id: 'cast_narrator',
        name: 'Narrator',
        kind: 'narrator',
        role: 'voiceover',
      },
    ],
    continuityReferences: [],
    episodes: [],
    sequences: [
      {
        id: 'seq_opening',
        number: 1,
        title: 'Opening',
        scenes: [
          {
            id: 'scene_opening',
            title: 'Opening Scene',
            clips: [
              {
                id: 'clip_opening',
                title: 'Opening Image',
              },
            ],
          },
        ],
      },
    ],
    counts: {
      languages: 0,
      visualLanguageCategories: 0,
      visualLanguage: 0,
      castMembers: 1,
      continuityReferences: 0,
      episodes: 0,
      sequences: 1,
      scenes: 1,
      clips: 1,
    },
  };
}
