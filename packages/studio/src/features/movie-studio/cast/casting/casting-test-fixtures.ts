import type {
  CastCastingResourceResponse,
  StudioAssetFileResponse,
} from '@/services/studio-project-contracts';

export function castingImage(id: string, type = 'casting_candidate'): StudioAssetFileResponse {
  return {
    id,
    title: null,
    type,
    mediaKind: 'image',
    url: `/assets/${id}`,
    createdAt: '2026-10-23T00:00:00.000Z',
  } as StudioAssetFileResponse;
}

/** A fictional six-scene film where Ada has two Looks, three costumes and two character sheets. */
export function castCastingResource(
  overrides: Partial<CastCastingResourceResponse> = {}
): CastCastingResourceResponse {
  return {
    castMember: { id: 'cast_ada', name: 'Ada' },
    scenes: [
      { id: 'scene_1', productionNumber: '1', heading: 'INT. CONTROL ROOM - NIGHT' },
      { id: 'scene_2', productionNumber: '2', heading: 'INT. CONTROL ROOM - LATER' },
      { id: 'scene_3', productionNumber: '3', heading: 'EXT. SUBSTATION - NIGHT' },
      { id: 'scene_4', productionNumber: '4', heading: 'INT. CONTROL ROOM - DAWN' },
      { id: 'scene_5', productionNumber: '5', heading: 'EXT. ROOF - DAY' },
      { id: 'scene_6', productionNumber: '6', heading: 'INT. CONTROL ROOM - YEARS LATER' },
    ],
    looks: [
      {
        id: 'look_young',
        castMemberId: 'cast_ada',
        name: 'Young',
        description: null,
        sceneIds: ['scene_2', 'scene_3', 'scene_4'],
        castCandidateAssetFileId: 'asset_young_b',
        castCandidate: castingImage('asset_young_b'),
        rounds: [{
          id: 'round_young_1',
          lookId: 'look_young',
          number: 1,
          routes: [{ provider: 'fictional', model: { key: 'lumen', name: 'Lumen Image' }, count: 3 }],
          maxConcurrentGenerations: 3,
          referenceAssetFileIds: [],
          estimatedCost: { amount: 0.3, currency: 'USD' },
          createdAt: '2026-10-23T00:00:00.000Z',
          expectedCount: 3,
          candidates: [
            { assetFileId: 'asset_young_a', roundId: 'round_young_1', status: 'candidate', modelKey: 'lumen', model: { key: 'lumen', name: 'Lumen Image' }, assetFile: castingImage('asset_young_a') },
            { assetFileId: 'asset_young_b', roundId: 'round_young_1', status: 'candidate', modelKey: 'lumen', model: { key: 'lumen', name: 'Lumen Image' }, assetFile: castingImage('asset_young_b') },
            { assetFileId: 'asset_young_c', roundId: 'round_young_1', status: 'hidden', modelKey: 'lumen', model: { key: 'lumen', name: 'Lumen Image' }, assetFile: castingImage('asset_young_c') },
          ],
        }],
      },
      {
        id: 'look_older',
        castMemberId: 'cast_ada',
        name: 'Years later',
        description: null,
        sceneIds: ['scene_1', 'scene_5', 'scene_6'],
        castCandidateAssetFileId: null,
        castCandidate: null,
        rounds: [{
          id: 'round_older_1',
          lookId: 'look_older',
          number: 1,
          routes: [
            { provider: 'fictional', model: { key: 'lumen', name: 'Lumen Image' }, count: 2 },
            { provider: 'fictional', model: { key: 'prism', name: 'Prism' }, count: 2 },
          ],
          maxConcurrentGenerations: 4,
          referenceAssetFileIds: [],
          estimatedCost: null,
          createdAt: '2026-10-23T00:00:00.000Z',
          expectedCount: 4,
          candidates: [
            { assetFileId: 'asset_older_a', roundId: 'round_older_1', status: 'candidate', modelKey: 'prism', model: { key: 'prism', name: 'Prism' }, assetFile: castingImage('asset_older_a') },
          ],
        }],
      },
    ],
    costumes: [
      { id: 'costume_overalls', castMemberId: 'cast_ada', lookId: 'look_young', name: 'Overalls', wardrobe: [], continuityNotes: [], sceneIds: ['scene_2', 'scene_3'], characterSheetAssetFileId: 'asset_sheet_overalls' },
      { id: 'costume_raincoat', castMemberId: 'cast_ada', lookId: 'look_young', name: 'Raincoat', wardrobe: [], continuityNotes: [], sceneIds: ['scene_4'], characterSheetAssetFileId: null },
      { id: 'costume_suit', castMemberId: 'cast_ada', lookId: 'look_older', name: 'Suit', wardrobe: [], continuityNotes: [], sceneIds: ['scene_1', 'scene_5', 'scene_6'], characterSheetAssetFileId: null },
    ],
    characterSheets: [
      castingImage('asset_sheet_overalls', 'character_sheet'),
      castingImage('asset_sheet_raincoat', 'character_sheet'),
    ],
    ...overrides,
  };
}
