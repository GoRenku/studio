// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ImageRevisionSourceRequest } from './image-revision-source-request';

describe('ImageRevisionSourceRequest', () => {
  it('shows the saved external provider, model, prompt, values, and references', () => {
    render(<ImageRevisionSourceRequest spec={{
      model: { provider: 'codex', model: 'gpt-image-2' },
      values: {
        prompt: 'The exact Codex prompt.',
        size: '1536x1024',
        quality: 'high',
      },
      referenceLabels: ['Wardrobe Study'],
    }} />);

    expect(screen.getByText('codex / gpt-image-2')).toBeTruthy();
    expect(screen.getByText('The exact Codex prompt.')).toBeTruthy();
    expect(screen.getByText('1536x1024')).toBeTruthy();
    expect(screen.getByText('high')).toBeTruthy();
    expect(screen.getByText(/Wardrobe Study/)).toBeTruthy();
  });
});
