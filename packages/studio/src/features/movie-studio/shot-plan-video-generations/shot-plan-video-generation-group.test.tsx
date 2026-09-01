// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { StudioShotPlanVideoAsset } from '@/services/studio-shot-plan-video-generations-contracts';
import { ShotPlanVideoGenerationGroup } from './shot-plan-video-generation-group';

vi.mock('@/features/media-generation-request/use-media-generation-request-inspector', () => ({
  useGenerationRequestInspectorDialog: () => ({
    openGenerationRequestInspector: vi.fn(),
  }),
}));

vi.mock('@/ui/media-card/media-card', () => ({
  MediaCard: ({ presentation }: {
    presentation: {
      copy: { title: string; description: string };
    };
  }) => (
    <div
      data-testid='video-take'
      data-title={presentation.copy.title}
      data-description={presentation.copy.description}
    />
  ),
}));

vi.mock('@/ui/media-card/media-card-grid', () => ({
  MediaCardGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ShotPlanVideoGenerationGroup', () => {
  it('shows newest takes first with chronological take numbers and creation times', () => {
    const olderCreatedAt = '2026-08-30T09:15:00.000Z';
    const newerCreatedAt = '2026-09-01T14:42:00.000Z';

    render(
      <ShotPlanVideoGenerationGroup
        projectName='urban-basilica'
        assets={[
          videoAsset('asset_older', olderCreatedAt),
          videoAsset('asset_newer', newerCreatedAt),
        ]}
        onDeleted={vi.fn()}
      />,
    );

    const cards = screen.getAllByTestId('video-take');
    expect(cards.map((card) => card.dataset.title)).toEqual(['Take 2', 'Take 1']);
    expect(cards.map((card) => card.dataset.description)).toEqual([
      formatDateTime(newerCreatedAt),
      formatDateTime(olderCreatedAt),
    ]);
  });
});

function videoAsset(id: string, createdAt: string): StudioShotPlanVideoAsset {
  return {
    id,
    createdAt,
    files: [{
      id: `file_${id}`,
      mediaKind: 'video',
      browserUrl: `/media/${id}.mp4`,
    }],
  } as StudioShotPlanVideoAsset;
}

function formatDateTime(createdAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(createdAt));
}
