// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VideoPreview } from './video-preview';

describe('VideoPreview', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('only preloads metadata until the preview is active', () => {
    render(<VideoPreview src='/take.mp4' title='Take preview' />);

    expect(screen.getByTitle('Take preview').getAttribute('preload')).toBe(
      'metadata'
    );
  });

  it('allows full preload while the preview is active', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);

    render(<VideoPreview src='/take.mp4' title='Take preview' active />);

    expect(screen.getByTitle('Take preview').getAttribute('preload')).toBe(
      'auto'
    );
  });
});
