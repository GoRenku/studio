// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectRelativePath } from '@gorenku/studio-core/client';
import { SceneShotVideoStage } from './scene-shot-video-stage';

vi.mock('@/ui/video-player', async () => {
  const ReactModule = await import('react');
  return {
    VideoPlayer({
      src,
      title,
      className,
    }: {
      src: string;
      title: string;
      className?: string;
    }) {
      return ReactModule.createElement('video', { src, title, className });
    },
  };
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??=
  ResizeObserverStub;

describe('SceneShotVideoStage', () => {
  it('renders a quiet placeholder without manual regenerate or copy controls', () => {
    render(<SceneShotVideoStage video={null} />);

    expect(screen.getByText('No shot video yet')).not.toBeNull();
    expect(
      screen.queryByRole('button', { name: /regenerate|duplicate|copy/i })
    ).toBeNull();
  });

  it('renders the active take video when present', () => {
    render(
      <SceneShotVideoStage
        video={{
          takeId: 'take_video',
          assetId: 'asset_video',
          assetFileId: 'asset_file_video',
          projectRelativePath:
            'generated/media/final-take.mp4' as ProjectRelativePath,
          mimeType: 'video/mp4',
          createdAt: '2026-07-02T00:00:00.000Z',
          url: '/studio-api/projects/constantinople/screenplay/scenes/scene_1/takes/take_video/video/files/asset_file_video',
        }}
      />
    );

    const video = screen.getByTitle('Shot video take');
    expect(video.tagName).toBe('VIDEO');
    expect(video.getAttribute('src')).toContain(
      '/studio-api/projects/constantinople'
    );
  });
});
