// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MediaCollectionItem } from './media-collection-section';
import { MediaCollectionSection } from './media-collection-section';

describe('MediaCollectionSection', () => {
  it('renders counts, cards, and the bounded empty state', () => {
    const { rerender } = render(
      <MediaCollectionSection
        title='Profile images'
        emptyTitle='No profile images yet.'
        items={[item('one'), item('two')]}
        minimumCardWidthPx={180}
      />
    );

    expect(screen.getByText('2 images')).not.toBeNull();
    expect(screen.getAllByRole('img')).toHaveLength(2);

    rerender(
      <MediaCollectionSection
        title='Profile images'
        emptyTitle='No profile images yet.'
        items={[]}
        minimumCardWidthPx={180}
      />
    );
    expect(screen.getByText('0 images')).not.toBeNull();
    expect(screen.getByText('No profile images yet.')).not.toBeNull();
  });

  it('uses stable item ids as keys when the collection order changes', () => {
    const { rerender } = render(
      <MediaCollectionSection
        title='Sheets'
        emptyTitle='No sheets yet.'
        items={[item('one'), item('two')]}
        minimumCardWidthPx={180}
      />
    );
    const firstImage = screen.getByRole('img', { name: 'one' });

    rerender(
      <MediaCollectionSection
        title='Sheets'
        emptyTitle='No sheets yet.'
        items={[item('two'), item('one')]}
        minimumCardWidthPx={180}
      />
    );

    expect(screen.getByRole('img', { name: 'one' })).toBe(firstImage);
  });
});

function item(id: string): MediaCollectionItem {
  return {
    id,
    card: {
      media: {
        kind: 'image',
        src: `/${id}.jpg`,
        alt: id,
        fit: 'cover',
        effect: 'none',
      },
      frame: { kind: 'ratio', aspectRatio: 1 },
      presentation: { kind: 'overlay' },
    },
  };
}
