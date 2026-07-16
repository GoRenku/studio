// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ShotVideoPreview } from './shot-video-preview';

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

describe('ShotVideoPreview', () => {
  it('renders a quiet placeholder without manual regenerate or copy controls', () => {
    render(<ShotVideoPreview video={null} />);

    expect(screen.getByText('No shot video yet')).not.toBeNull();
    expect(
      screen.queryByRole('button', { name: /regenerate|duplicate|copy/i })
    ).toBeNull();
  });

  it('renders the active take video when present', () => {
    render(
      <ShotVideoPreview
        video={{
          url: '/studio-api/projects/constantinople/assets/asset_file_video',
        }}
      />
    );

    const video = screen.getByTitle('Shot video preview');
    expect(video.tagName).toBe('VIDEO');
    expect(video.getAttribute('src')).toContain(
      '/studio-api/projects/constantinople'
    );
  });
});
