import type {
  Asset,
  Project,
  ProjectShell,
} from '@gorenku/studio-core/client';

export function makeAsset(assetId: string): Asset {
  return {
    id: assetId,
    owner: { kind: 'castMember', id: 'cast_narrator' },
    localeId: null,
    type: 'reference',
    availability: 'ready',
    mediaKind: 'image',
    title: 'Narrator reference',
    oneLineSummary: null,
    origin: 'imported',
    referenceName: null,
    purpose: null,
    files: [
      {
        id: 'asset_file_cast_reference',
        role: 'primary',
        projectRelativePath:
          'cast/narrator/reference.png' as Asset['files'][number]['projectRelativePath'],
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
    cast: project.cast,
    counts: project.counts,
    navigation: {
      cast: {
        items: project.cast.map((castMember) => ({
          id: castMember.id,
          handle: castMember.id,
          name: castMember.name,
          role: castMember.role,
          isVoiceOver: castMember.isVoiceOver,
        })),
        nextCursor: null,
      },
      locations: { items: [], nextCursor: null },
      props: { items: [], nextCursor: null },
      screenplay: {
        acts: {
          items: [{
            id: 'act_opening',
            title: 'Opening Act',
            sequenceCount: project.sequences.length,
            sceneCount: project.sequences.reduce(
              (total, sequence) => total + sequence.scenes.length,
              0
            ),
          }],
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
      folderPath: '/tmp/renku/constantinople',
      databasePath: '/tmp/renku/constantinople/.renku/project.sqlite',
      aspectRatio: '16:9',
    },
    coverImage: { fileName: 'cover.png' },
    languages: [],
    cast: [
      {
        id: 'cast_narrator',
        handle: 'narrator',
        name: 'Narrator',
        isVoiceOver: true,
        role: 'voiceover',
      },
    ],
    locations: [],
    props: [],
    sequences: [
      {
        id: 'seq_opening',
        number: 1,
        title: 'Opening',
        scenes: [
          {
            id: 'scene_opening',
            title: 'Opening Scene',
          },
        ],
      },
    ],
    counts: {
      languages: 0,
      castMembers: 1,
      locations: 0,
      props: 0,
      acts: 1,
      sequences: 1,
      scenes: 1,
    },
  };
}
