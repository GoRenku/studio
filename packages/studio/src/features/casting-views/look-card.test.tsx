// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LookCard } from './look-card';

describe('LookCard', () => {
  it('shows the cast image, scenes and details', () => {
    render(
      <LookCard
        name='Young'
        sceneSummary='Scenes 3–8'
        imageUrl='/young.png'
        tone='lookA'
        details={['Cast from round 1 of 1 · Lumen Image', '2 costumes · 2 sheets picked']}
      />
    );

    expect(screen.getByRole('heading', { name: 'Young' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Young, cast' }).getAttribute('src')).toBe('/young.png');
    expect(screen.getByText('Scenes 3–8')).toBeTruthy();
    expect(screen.getByText('2 costumes · 2 sheets picked')).toBeTruthy();
  });

  it('keeps a quiet placeholder before the Look is cast', () => {
    render(<LookCard name='Older' sceneSummary='Scene 9' imageUrl={null} tone='lookB' details={['Not cast yet']} />);

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Not cast yet')).toBeTruthy();
  });
});
