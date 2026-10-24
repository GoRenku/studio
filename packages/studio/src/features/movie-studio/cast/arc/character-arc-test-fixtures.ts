import type { CastMemberCharacterArcResourceResponse } from '@/services/studio-project-contracts';

/** A fictional four-scene film for Arc tab tests. */
export function characterArcResource(
  overrides: Partial<CastMemberCharacterArcResourceResponse> = {}
): CastMemberCharacterArcResourceResponse {
  return {
    castMember: { id: 'cast_ada', name: 'Ada', role: 'Protagonist' },
    arc: {
      kind: 'characterArc',
      arcType: 'positiveChange',
      startState: 'Trusts only machines.',
      endState: 'Asks for help.',
      ends: { high: 'Asks for help', low: 'Works alone' },
      spine: {
        want: { text: 'Keep the grid alive.', sceneIds: ['scene_1'] },
        need: { text: 'Admit she cannot do it alone.', sceneIds: ['scene_3'] },
        falseBelief: { text: 'Help is weakness.', sceneIds: ['scene_2'] },
      },
      turningPoints: [
        { sceneIds: ['scene_1'], label: 'Night shift', state: 'Alone and proud.', position: -3, characterSheetAssetFileId: 'asset_sheet' },
        { sceneIds: ['scene_2', 'scene_3'], label: 'Blackout', state: 'Overwhelmed.', position: -5, quote: 'I have it.' },
        { sceneIds: ['scene_4'], label: 'Calls the apprentice', state: 'Relieved.', position: 4 },
      ],
    },
    scenes: [
      { id: 'scene_1', productionNumber: '1', heading: 'INT. CONTROL ROOM - NIGHT' },
      { id: 'scene_2', productionNumber: '2', heading: 'INT. CONTROL ROOM - LATER' },
      { id: 'scene_3', productionNumber: '3', heading: 'EXT. SUBSTATION - NIGHT' },
      { id: 'scene_4', productionNumber: '4', heading: 'INT. CONTROL ROOM - DAWN' },
    ],
    presence: [
      { sceneId: 'scene_1', speaks: true },
      { sceneId: 'scene_3', speaks: false },
    ],
    structure: {
      actSegments: [
        { role: 'actOne', title: 'The Shift', sceneIds: ['scene_1'] },
        { role: 'actTwo', title: 'The Blackout', sceneIds: ['scene_2', 'scene_3'] },
        { role: 'actThree', title: 'The Call', sceneIds: ['scene_4'] },
      ],
      keyBeats: [{ key: 'midpoint', sceneId: 'scene_2' }, { key: 'climax', sceneId: 'scene_4' }],
    },
    characterSheets: [{
      id: 'asset_sheet',
      title: 'Ada — Night Shift',
      type: 'character_sheet',
      mediaKind: 'image',
    } as CastMemberCharacterArcResourceResponse['characterSheets'][number]],
    freshness: 'current',
    freshnessHelp: null,
    ...overrides,
  };
}
