import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  MediaGenerationDependencySlot,
  ShotVideoTakeOutputGenerationSpec,
} from '../../../client/index.js';

vi.mock('../../database/access/asset-relationships/index.js', () => ({
  MAX_RESOURCE_PAGE_LIMIT: 100,
  listAssetRelationshipPage: vi.fn(),
}));

vi.mock('../../database/access/lookbook-sheets.js', () => ({
  listLookbookSheets: vi.fn(),
}));

import {
  listAssetRelationshipPage,
} from '../../database/access/asset-relationships/index.js';
import { listLookbookSheets } from '../../database/access/lookbook-sheets.js';
import { resolveMediaGenerationDependencySelection } from './dependency-selectors.js';

const mockedListAssetRelationshipPage = vi.mocked(listAssetRelationshipPage);
const mockedListLookbookSheets = vi.mocked(listLookbookSheets);

describe('media generation dependency selectors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects shot video selectors without a media generation spec request', () => {
    const result = resolveMediaGenerationDependencySelection({
      session: {} as never,
      slot: shotVideoInputSlot(),
      request: { kind: 'test' },
    });

    expect(result).toEqual({
      state: 'invalid-selection',
      asset: null,
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_MEDIA_DEPENDENCY_SELECTOR_REQUEST_INVALID',
          severity: 'error',
        }),
      ],
    });
  });

  it('selects the matching shot video input from a final spec', () => {
    const result = resolveMediaGenerationDependencySelection({
      session: {} as never,
      slot: shotVideoInputSlot(),
      request: {
        kind: 'media-generation-spec',
        spec: shotVideoSpec([
          {
            kind: 'first-frame',
            assetId: 'asset-frame',
            assetFileId: 'file-frame',
            projectRelativePath: 'generated/frame.png' as never,
          },
        ]),
      },
    });

    expect(result).toEqual({
      state: 'satisfied',
      asset: {
        assetId: 'asset-frame',
        assetFileId: 'file-frame',
        projectRelativePath: 'generated/frame.png',
      },
      diagnostics: [],
    });
  });

  it('reports ambiguous or fileless shot video inputs as invalid selections', () => {
    expect(
      resolveMediaGenerationDependencySelection({
        session: {} as never,
        slot: shotVideoInputSlot(),
        request: {
          kind: 'media-generation-spec',
          spec: shotVideoSpec([
            { kind: 'first-frame', assetId: 'asset-a', assetFileId: 'file-a' },
            { kind: 'first-frame', assetId: 'asset-b', assetFileId: 'file-b' },
          ]),
        },
      })
    ).toMatchObject({
      state: 'invalid-selection',
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_MEDIA_DEPENDENCY_AMBIGUOUS_SELECTED_ASSET',
        }),
      ],
    });

    expect(
      resolveMediaGenerationDependencySelection({
        session: {} as never,
        slot: shotVideoInputSlot(),
        request: {
          kind: 'media-generation-spec',
          spec: shotVideoSpec([{ kind: 'first-frame', assetId: 'asset-a' }]),
        },
      })
    ).toMatchObject({
      state: 'invalid-selection',
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_MEDIA_DEPENDENCY_SELECTED_ASSET_FILE_MISSING',
        }),
      ],
    });
  });

  it('uses selected-or-default asset relationships and validates required files', () => {
    mockedListAssetRelationshipPage
      .mockReturnValueOnce({ items: [] } as never)
      .mockReturnValueOnce({
        items: [
          assetRelationship({
            assetId: 'asset-default',
            files: [
              {
                id: 'file-default',
                mediaKind: 'image',
                role: 'primary',
                projectRelativePath: 'generated/default.png' as never,
              },
            ],
          }),
        ],
      } as never);

    expect(
      resolveMediaGenerationDependencySelection({
        session: {} as never,
        slot: assetRelationshipSlot({
          selectionPolicy: 'selected-or-default',
          fileRole: 'primary',
        }),
      })
    ).toEqual({
      state: 'satisfied',
      asset: {
        assetId: 'asset-default',
        assetFileId: 'file-default',
        projectRelativePath: 'generated/default.png',
      },
      diagnostics: [],
    });

    mockedListAssetRelationshipPage.mockReturnValueOnce({
      items: [
        assetRelationship({
          assetId: 'asset-fileless',
          files: [{ id: 'file-audio', mediaKind: 'audio', role: 'primary' }],
        }),
      ],
    } as never);

    expect(
      resolveMediaGenerationDependencySelection({
        session: {} as never,
        slot: assetRelationshipSlot({
          assetId: 'asset-fileless',
          selectionPolicy: 'selected-only',
          fileRole: 'primary',
        }),
      })
    ).toMatchObject({
      state: 'invalid-selection',
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_MEDIA_DEPENDENCY_SELECTED_ASSET_FILE_MISSING',
        }),
      ],
    });
  });

  it('reports ambiguous selected asset relationships', () => {
    mockedListAssetRelationshipPage.mockReturnValueOnce({
      items: [
        assetRelationship({ assetId: 'asset-a' }),
        assetRelationship({ assetId: 'asset-b' }),
      ],
    } as never);

    expect(
      resolveMediaGenerationDependencySelection({
        session: {} as never,
        slot: assetRelationshipSlot({ selectionPolicy: 'selected-only' }),
      })
    ).toMatchObject({
      state: 'invalid-selection',
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_MEDIA_DEPENDENCY_AMBIGUOUS_SELECTED_ASSET',
        }),
      ],
    });
  });

  it('selects Lookbook sheets and reports stale sheet ids', () => {
    mockedListLookbookSheets.mockReturnValueOnce([
      {
        id: 'sheet-a',
        asset: {
          assetId: 'asset-sheet',
          files: [
            {
              id: 'file-sheet',
              mediaKind: 'image',
              projectRelativePath: 'generated/sheet.png' as never,
            },
          ],
        },
      },
    ] as never);

    expect(
      resolveMediaGenerationDependencySelection({
        session: {} as never,
        slot: lookbookSheetSlot({ selectionPolicy: 'selected-or-default' }),
      })
    ).toMatchObject({
      state: 'satisfied',
      asset: {
        assetId: 'asset-sheet',
        assetFileId: 'file-sheet',
        projectRelativePath: 'generated/sheet.png',
      },
    });

    mockedListLookbookSheets.mockReturnValueOnce([] as never);
    expect(
      resolveMediaGenerationDependencySelection({
        session: {} as never,
        slot: lookbookSheetSlot({
          lookbookSheetId: 'stale-sheet',
          selectionPolicy: 'selected-only',
        }),
      })
    ).toMatchObject({
      state: 'invalid-selection',
      diagnostics: [
        expect.objectContaining({
          code: 'CORE_MEDIA_DEPENDENCY_LOOKBOOK_SHEET_SELECTION_INVALID',
        }),
      ],
    });
  });

  it('returns missing for manual attachments', () => {
    expect(
      resolveMediaGenerationDependencySelection({
        session: {} as never,
        slot: {
          dependencyId: 'manual:test',
          dependencyKind: 'manual-attachment',
          label: 'Manual plate',
          dependencyTarget: { kind: 'scene', id: 'scene-a' },
          selector: {
            kind: 'manual-attachment',
            target: { kind: 'scene', id: 'scene-a' },
          },
          required: true,
          reason: 'Manual attachment.',
        },
      })
    ).toEqual({ state: 'missing', asset: null, diagnostics: [] });
  });
});

function shotVideoInputSlot(): MediaGenerationDependencySlot {
  return {
    dependencyId: 'first-frame:take:take-a',
    dependencyKind: 'first-frame',
    label: 'First frame',
    dependencyTarget: {
      kind: 'sceneShotVideoTake',
      id: 'scene-a:take-a',
      sceneId: 'scene-a',
      takeId: 'take-a',
      shotIds: ['shot-a'],
    },
    selector: {
      kind: 'shot-video-input',
      inputKind: 'first-frame',
      takeId: 'take-a',
      shotIds: ['shot-a'],
    },
    required: true,
    reason: 'Route requires a first frame.',
  };
}

function shotVideoSpec(
  inputs: Array<Partial<ShotVideoTakeOutputGenerationSpec['inputs'][number]>>
): ShotVideoTakeOutputGenerationSpec {
  return {
    purpose: 'shot.video-take',
    target: {
      kind: 'sceneShotVideoTake',
      id: 'scene-a:take-a',
      sceneId: 'scene-a',
      takeId: 'take-a',
      shotIds: ['shot-a'],
    },
    inputs,
  } as ShotVideoTakeOutputGenerationSpec;
}

function assetRelationshipSlot(input: {
  assetId?: string;
  selectionPolicy: 'selected-only' | 'selected-or-default';
  fileRole?: string;
}): MediaGenerationDependencySlot {
  return {
    dependencyId: input.assetId
      ? `cast-character-sheet:cast-a:${input.assetId}`
      : 'cast-character-sheet:cast-a',
    dependencyKind: 'cast-character-sheet',
    label: 'Ada character sheet',
    dependencyTarget: { kind: 'castMember', id: 'cast-a' },
    selector: {
      kind: 'asset-relationship',
      target: { kind: 'castMember', castMemberId: 'cast-a' },
      ...(input.assetId ? { assetId: input.assetId } : {}),
      role: 'character_sheet',
      mediaKind: 'image',
      ...(input.fileRole ? { fileRole: input.fileRole } : {}),
      selectionPolicy: input.selectionPolicy,
    },
    required: true,
    reason: 'Character reference.',
  };
}

function lookbookSheetSlot(input: {
  lookbookSheetId?: string;
  selectionPolicy: 'selected-only' | 'selected-or-default';
}): MediaGenerationDependencySlot {
  return {
    dependencyId: 'lookbook-sheet:lookbook-a',
    dependencyKind: 'lookbook-sheet',
    label: 'Lookbook sheet',
    dependencyTarget: { kind: 'lookbook', id: 'lookbook-a' },
    selector: {
      kind: 'lookbook-sheet',
      lookbookId: 'lookbook-a',
      ...(input.lookbookSheetId ? { lookbookSheetId: input.lookbookSheetId } : {}),
      selectionPolicy: input.selectionPolicy,
    },
    required: true,
    reason: 'Style reference.',
  };
}

function assetRelationship(input: {
  assetId: string;
  files?: Array<{
    id: string;
    mediaKind: string;
    role?: string;
    projectRelativePath?: string;
  }>;
}) {
  return {
    assetId: input.assetId,
    files: input.files ?? [
      {
        id: `file-${input.assetId}`,
        mediaKind: 'image',
        role: 'primary',
        projectRelativePath: `generated/${input.assetId}.png` as never,
      },
    ],
  };
}
