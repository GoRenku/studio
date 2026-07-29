// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScreenplayEntityImagePreview } from './screenplay-entity-image-preview';

describe('ScreenplayEntityImagePreview', () => {
  it('uses a square image-only frame for Cast Members', () => {
    const { container } = render(
      <ScreenplayEntityImagePreview
        kind='castMember'
        label='Urban'
        imageUrl='/urban-profile.jpg'
      />
    );

    expect(screen.getByRole('img', { name: 'Urban profile image' }).className)
      .toContain('aspect-square');
    expect(
      container.querySelector('[data-screenplay-entity-preview]')?.className
    ).toContain('border-2');
    expect(
      container.querySelector('[data-screenplay-entity-preview]')?.className
    ).toContain('border-muted-foreground/70');
    expect(container.textContent).toBe('');
  });

  it('uses a widescreen image-only frame for Locations', () => {
    render(
      <ScreenplayEntityImagePreview
        kind='location'
        label='Imperial Council Chamber'
        imageUrl='/chamber-hero.jpg'
      />
    );

    expect(
      screen.getByRole('img', {
        name: 'Imperial Council Chamber hero image',
      }).className
    ).toContain('aspect-video');
  });
});
