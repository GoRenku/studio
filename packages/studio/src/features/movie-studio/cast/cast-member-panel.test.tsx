// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render as renderTestingLibrary, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CastMemberResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import {
  deleteCastVoice,
  readCastAssets,
  setCastProfileDisplayAsset,
  clearCastProfileDisplayAsset,
} from '@/services/studio-project-assets-api';
import { readCastMemberResource } from '@/services/studio-screenplay-api';
import { CastMemberPanel } from './cast-member-panel';
import { ImageRevisionDialogProvider } from '@/features/image-revision/image-revision-dialog-provider';

function render(ui: React.ReactElement) {
  return renderTestingLibrary(
    <ImageRevisionDialogProvider>{ui}</ImageRevisionDialogProvider>,
  );
}

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/services/studio-project-assets-api', () => ({
  castAssetFileUrl: vi.fn(
    (
      projectName: string,
      castMemberId: string,
      assetId: string,
      fileId: string
    ) =>
      `/studio-api/projects/${projectName}/cast/${castMemberId}/assets/${assetId}/files/${fileId}`
  ),
  deleteCastAsset: vi.fn(),
  deleteCastVoice: vi.fn(),
  readCastAssets: vi.fn(),
  setCastProfileDisplayAsset: vi.fn(),
  clearCastProfileDisplayAsset: vi.fn(),
}));

vi.mock('@/services/studio-screenplay-api', () => ({
  readCastMemberResource: vi.fn(),
}));

describe('CastMemberPanel', () => {
  beforeEach(() => {
    vi.mocked(readCastAssets).mockReset();
    vi.mocked(setCastProfileDisplayAsset).mockReset();
    vi.mocked(clearCastProfileDisplayAsset).mockReset();
    vi.mocked(deleteCastVoice).mockReset();
    vi.mocked(readCastMemberResource).mockReset();
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue();
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  });

  it('unselects the current profile pick when the pick control is clicked again', async () => {
    vi.mocked(readCastMemberResource).mockResolvedValue({
      ...castMemberResource(),
      firstImage: {
        assetId: 'asset_profile',
        relationshipId: 'asset_relationship_profile',
        assetFileId: 'asset_file_profile',
        title: 'Urban profile',
        fileRole: 'primary',
        mediaKind: 'image',
        mimeType: 'image/png',
        width: 1024,
        height: 1024,
        url: '/profile.png',
      },
    });
    vi.mocked(readCastAssets)
      .mockResolvedValueOnce([castProfileAsset()])
      .mockResolvedValueOnce([castProfileAsset()]);
    vi.mocked(clearCastProfileDisplayAsset).mockResolvedValue(undefined);

    render(
      <CastMemberPanel
        projectName='constantinople'
        castMemberId='cast_urban'
      />
    );

    const assetsTab = await screen.findByRole('tab', {
      name: 'Assets',
    });
    activateTab(assetsTab);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Clear profile image pick',
      })
    );

    await waitFor(() => {
      expect(clearCastProfileDisplayAsset).toHaveBeenCalledWith(
        'constantinople',
        'cast_urban'
      );
    });
    expect(setCastProfileDisplayAsset).not.toHaveBeenCalled();
  });

  it('renders Details narrative facts without visual-anchor copy or a Voice Design tab', async () => {
    vi.mocked(readCastMemberResource).mockResolvedValue(
      castMemberResource({
        arc: 'Learns to ask for help before the machine breaks him.',
        voiceNotes: 'Low, clipped, dry under pressure.',
      })
    );
    vi.mocked(readCastAssets).mockResolvedValue([castProfileAsset()]);

    render(
      <CastMemberPanel
        projectName='constantinople'
        castMemberId='cast_urban'
      />
    );

    expect(await screen.findByText('Arc')).toBeTruthy();
    expect(screen.getByText('Voice Notes')).toBeTruthy();
    expect(screen.queryByText('Visual Anchor')).toBeNull();
    expect(screen.queryByRole('tab', { name: 'Voice Design' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Assets' })).toBeTruthy();
  });

  it('shows Character Sheet footers without a pick control or raw filename copy', async () => {
    vi.mocked(readCastMemberResource).mockResolvedValue(castMemberResource());
    vi.mocked(readCastAssets).mockResolvedValue([
      castProfileAsset(),
      castCharacterSheetAsset(),
    ]);

    render(
      <CastMemberPanel
        projectName='constantinople'
        castMemberId='cast_urban'
      />
    );

    const assetsTab = await screen.findByRole('tab', { name: 'Assets' });
    activateTab(assetsTab);

    expect(await screen.findByText('Standard Sheet')).toBeTruthy();
    expect(screen.getByText('default costume and face reference')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Set character sheet pick' })
    ).toBeNull();
    expect(screen.queryByText('urban-sheet.png')).toBeNull();
    expect(screen.queryByText('asset_character_sheet')).toBeNull();
  });

  it('plays and deletes Voice Sample cards from the Assets tab', async () => {
    vi.mocked(readCastMemberResource).mockResolvedValue(
      castMemberResource({ voices: [castVoiceSample()] })
    );
    vi.mocked(readCastAssets).mockResolvedValue([]);
    vi.mocked(deleteCastVoice).mockResolvedValue({
      castMemberId: 'cast_urban',
      voiceId: 'cast_voice_normal',
      sampleAssetId: 'asset_voice_sample',
    });

    render(
      <CastMemberPanel
        projectName='constantinople'
        castMemberId='cast_urban'
      />
    );

    const assetsTab = await screen.findByRole('tab', { name: 'Assets' });
    activateTab(assetsTab);

    fireEvent.click(await screen.findByRole('button', { name: 'Play Normal Voice' }));
    expect(
      await screen.findByRole('button', { name: 'Pause Normal Voice' })
    ).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getByText('Normal Voice')).toBeTruthy();
    expect(screen.getByText('calm strategic baseline')).toBeTruthy();
    expect(screen.queryByText('urban-normal.mp3')).toBeNull();
    expect(screen.queryByText('asset_voice_sample')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Delete voice sample' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteCastVoice).toHaveBeenCalledWith(
        'constantinople',
        'cast_urban',
        'cast_voice_normal'
      );
    });
  });
});

function castMemberResource(
  overrides: Partial<CastMemberResourceResponse['castMember']> & {
    voices?: CastMemberResourceResponse['voices'];
  } = {}
): CastMemberResourceResponse {
  const { voices = [], isVoiceOver = false, ...castMemberOverrides } = overrides;
  return {
    castMember: {
      id: 'cast_urban',
      handle: 'urban',
      name: 'Urban',
      role: 'protagonist',
      isVoiceOver,
      description: 'An engineer under pressure.',
      ...castMemberOverrides,
    },
    voices,
  };
}

function activateTab(tab: HTMLElement): void {
  fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
  fireEvent.pointerUp(tab);
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.mouseUp(tab);
  fireEvent.click(tab);
}

function castProfileAsset(): StudioAssetResponse {
  return {
    assetId: 'asset_profile',
    relationshipId: 'asset_relationship_profile',
    target: { kind: 'castMember', castMemberId: 'cast_urban' },
    localeId: null,
    type: 'cast_profile',
    availability: 'ready',
    mediaKind: 'image',
    title: 'Urban profile',
    oneLineSummary: null,
    origin: 'generated',
    role: 'profile',
    referenceName: null,
    purpose: null,
    sortOrder: 0,
    files: [
      {
        id: 'asset_file_profile',
        role: 'primary',
        projectRelativePath: 'cast/urban/profile.png' as never,
        mediaKind: 'image',
        mimeType: 'image/png',
        sizeBytes: 123,
        contentHash: null,
        width: 1024,
        height: 1024,
        durationSeconds: null,
      },
    ],
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
  };
}

function castCharacterSheetAsset(): StudioAssetResponse {
  return {
    ...castProfileAsset(),
    assetId: 'asset_character_sheet',
    relationshipId: 'asset_relationship_character_sheet',
    type: 'character_sheet',
    mediaKind: 'image',
    title: 'Urban Sheet',
    role: 'character-sheet',
    referenceName: 'standard-sheet',
    purpose: 'default costume and face reference',
    files: [
      {
        id: 'asset_file_character_sheet',
        role: 'primary',
        projectRelativePath: 'cast/urban/urban-sheet.png' as never,
        mediaKind: 'image',
        mimeType: 'image/png',
        sizeBytes: 456,
        contentHash: null,
        width: 1600,
        height: 1200,
        durationSeconds: null,
      },
    ],
  };
}

function castVoiceSample(): CastMemberResourceResponse['voices'][number] {
  return {
    id: 'cast_voice_normal',
    castMemberId: 'cast_urban',
    name: 'normal-voice',
    purpose: 'calm strategic baseline',
    sampleSource: { kind: 'generated_sample' },
    providerRegistrations: [
      {
        id: 'cast_voice_provider_registration_normal',
        castVoiceId: 'cast_voice_normal',
        provider: 'elevenlabs',
        registrationModel: 'eleven_v3',
        externalVoiceId: 'voice_urban_normal',
        capabilities: ['dialogue-audio-tts'],
        sourceSampleAssetId: 'asset_voice_sample',
        createdAt: '2026-05-26T00:00:00.000Z',
        updatedAt: '2026-05-26T00:00:00.000Z',
      },
    ],
    sample: {
      assetId: 'asset_voice_sample',
      relationshipId: 'asset_relationship_voice_sample',
      target: { kind: 'castMember', castMemberId: 'cast_urban' },
      localeId: null,
      type: 'cast_voice_sample',
      availability: 'ready',
      mediaKind: 'audio',
      title: 'Urban normal voice sample',
      oneLineSummary: null,
      origin: 'generated',
      role: 'voice_sample',
      referenceName: 'normal-voice',
      purpose: 'calm strategic baseline',
      sortOrder: 0,
      files: [
        {
          id: 'asset_file_voice_sample',
          role: 'primary',
          projectRelativePath: 'cast/urban/urban-normal.mp3' as never,
          mediaKind: 'audio',
          mimeType: 'audio/mpeg',
          sizeBytes: 789,
          contentHash: null,
          width: null,
          height: null,
          durationSeconds: 2.1,
          url: '/studio-api/projects/constantinople/cast/cast_urban/assets/asset_voice_sample/files/asset_file_voice_sample',
        },
      ],
      createdAt: '2026-05-26T00:00:00.000Z',
      updatedAt: '2026-05-26T00:00:00.000Z',
    },
    createdAt: '2026-05-26T00:00:00.000Z',
    updatedAt: '2026-05-26T00:00:00.000Z',
  };
}
