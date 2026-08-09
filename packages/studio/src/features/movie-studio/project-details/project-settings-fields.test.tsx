// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectSettingsDocument } from '@gorenku/studio-core/client';
import { ProjectSettingsFields } from './project-settings-fields';

describe('ProjectSettingsFields', () => {
  it('shows four independent accordion groups with the accepted copy, controls, and defaults', () => {
    render(
      <ProjectSettingsFields settings={settings()} onChange={() => undefined} />
    );

    expect(screen.getByText('Screenplay Import')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Create cast, locations, and props' }).getAttribute('data-state')).toBe('checked');
    expect(screen.getByRole('switch', { name: 'Generate profile and hero images' }).getAttribute('data-state')).toBe('unchecked');
    expect(screen.getByText('After importing Final Draft, continue with unambiguous continuity facts and screenplay reference bindings.')).toBeTruthy();

    const generation = screen.getByRole('button', { name: 'Generation' });
    const renkuManaged = screen.getByRole('button', {
      name: 'Renku-managed generation',
    });
    const codexBuiltIn = screen.getByRole('button', {
      name: 'Codex built-in image generation',
    });
    expect(generation.getAttribute('aria-expanded')).toBe('false');
    expect(renkuManaged.getAttribute('aria-expanded')).toBe('false');
    expect(codexBuiltIn.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(generation);
    expect(screen.getByRole('switch', { name: 'Prefer Codex for image generation' }).getAttribute('data-state')).toBe('checked');

    fireEvent.click(renkuManaged);
    fireEvent.click(codexBuiltIn);
    expect(renkuManaged.getAttribute('aria-expanded')).toBe('true');
    expect(codexBuiltIn.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByText('Max concurrent generations')).toHaveLength(2);
  });

  it('disables a lane maximum without changing its stored value', () => {
    const onChange = vi.fn();
    const value = settings();
    value.generation.renkuManaged.allowConcurrentGenerations = true;
    value.generation.renkuManaged.maxConcurrentGenerations = 3;
    render(<ProjectSettingsFields settings={value} onChange={onChange} />);
    fireEvent.click(
      screen.getByRole('button', { name: 'Renku-managed generation' })
    );

    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Run generations concurrently',
        description: /Renku-managed/,
      })
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        generation: expect.objectContaining({
          renkuManaged: expect.objectContaining({
            allowConcurrentGenerations: false,
            maxConcurrentGenerations: 3,
          }),
        }),
      })
    );
  });
});

function settings(): ProjectSettingsDocument {
  return {
    version: 2,
    screenplayImport: {
      createContinuitySubjects: true,
      generateContinuityImages: false,
      runScreenplayAnalysis: false,
      generateSceneBeats: false,
      generateBeatStoryboardImages: false,
    },
    generation: {
      preferCodexImageGeneration: true,
      displayPreview: true,
      renkuManaged: {
        requirePerRunConfirmation: true,
        allowConcurrentGenerations: false,
        maxConcurrentGenerations: 1,
      },
      codexBuiltIn: {
        requirePerRunConfirmation: false,
        allowConcurrentGenerations: true,
        maxConcurrentGenerations: 5,
      },
    },
  };
}
