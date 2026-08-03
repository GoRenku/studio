import type { Asset, Project, ProjectShell, Screenplay } from '@gorenku/studio-core/client';

export const fixtureCastMember = {
  id: 'cast_narrator',
  handle: 'narrator',
  name: 'Narrator',
  isVoiceOver: true,
  role: 'voiceover',
};

export const fixtureScreenplay: Screenplay = {
  opening: [],
  scenes: [{
    id: 'scene_opening',
    productionNumber: '1',
    heading: 'EXT. THEODOSIAN WALLS - DAWN',
    title: 'Opening Scene',
    blocks: [{ id: 'block_opening_action', type: 'action', text: 'The siege begins.' }],
  }],
  sections: [
    { id: 'act_opening', type: 'act', title: 'Opening Act' },
    { id: 'seq_opening', type: 'sequence', title: 'Opening' },
  ],
  structure: [
    { id: 'structure_act_opening', content: { type: 'section', sectionId: 'act_opening' }, position: 0 },
    { id: 'structure_seq_opening', parentSectionId: 'act_opening', content: { type: 'section', sectionId: 'seq_opening' }, position: 0 },
    { id: 'structure_scene_opening', parentSectionId: 'seq_opening', content: { type: 'scene', sceneId: 'scene_opening' }, position: 0 },
  ],
  references: [],
};

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
    files: [{
      id: 'asset_file_cast_reference',
      role: 'primary',
      projectRelativePath: 'cast/narrator/reference.png' as Asset['files'][number]['projectRelativePath'],
      mediaKind: 'image',
      mimeType: 'image/png',
      sizeBytes: 12,
      contentHash: null,
      width: null,
      height: null,
      durationSeconds: null,
    }],
    createdAt: '2026-05-12T00:00:00.000Z',
    updatedAt: '2026-05-12T00:00:00.000Z',
  };
}

export function makeProjectShell(project: Project): ProjectShell {
  return {
    project,
    languages: [],
    navigation: {
      cast: { items: [fixtureCastMember], nextCursor: null },
      locations: { items: [], nextCursor: null },
      props: { items: [], nextCursor: null },
      screenplay: { screenplay: fixtureScreenplay, orderedSceneIds: ['scene_opening'] },
    },
  };
}

export function makeProject(): Project {
  return {
    id: 'project_test0001',
    projectName: 'constantinople',
    title: 'Preparation of the Siege',
    aspectRatio: '16:9',
    coverImage: { fileName: 'cover.png' },
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
