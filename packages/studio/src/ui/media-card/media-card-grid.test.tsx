// @vitest-environment jsdom
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MediaCardGrid } from './media-card-grid';

describe('MediaCardGrid', () => {
  it.each([
    ['compact', 'gap-2'],
    ['standard', 'gap-3'],
    ['roomy', 'gap-4'],
  ] as const)('uses the requested %s gap', (gap, expectedClass) => {
    const { container } = render(
      <MediaCardGrid minimumCardWidthPx={220} gap={gap}>
        <div>Card</div>
      </MediaCardGrid>
    );
    const grid = container.querySelector<HTMLElement>('[data-media-card-grid]');

    expect(grid?.classList.contains(expectedClass)).toBe(true);
    expect(grid?.style.gridTemplateColumns).toBe(
      'repeat(auto-fill, minmax(220px, 1fr))'
    );
  });
});
