// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { MediaGenerationPreviewResource } from '@gorenku/studio-core/client';
import { MediaGenerationRequestView } from './media-generation-request-view';
import { MediaGenerationRequestDialog } from './media-generation-request-dialog';
import { MediaGenerationPreviewDialog } from './media-generation-preview-dialog';

describe('MediaGenerationRequestView', () => {
  it('renders the shared schema-free tabs and an editable Preview prompt without a Generate action', () => {
    render(<MediaGenerationRequestView preview={preview()} prompt='Stone arch' tab='prompt' onPromptChange={() => undefined} onTabChange={() => undefined} />);
    expect(screen.getByRole('tab', { name: 'Prompt' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'References' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Configuration' })).toBeTruthy();
    expect(screen.getByLabelText('Media generation prompt').getAttribute('aria-readonly')).toBe('false');
    expect(screen.queryByRole('button', { name: /generate/i })).toBeNull();
  });

  it('makes Inspection prompt read-only while preserving the same view', () => {
    render(<MediaGenerationRequestView preview={{ ...preview(), documentPath: undefined, editable: false }} prompt='Stone arch' tab='prompt' onPromptChange={() => undefined} onTabChange={() => undefined} />);
    expect(screen.getByLabelText('Media generation prompt').getAttribute('aria-readonly')).toBe('true');
  });

  it('renders nested objects, arrays, primitives, null, and empty values without provider schemas', () => {
    render(<MediaGenerationRequestView preview={preview()} prompt='Stone arch' tab='configuration' onPromptChange={() => undefined} onTabChange={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Nested' })).toBeTruthy();
    expect((screen.getByRole('textbox', { name: '1' }) as HTMLInputElement).value).toBe('Not set');
    expect((screen.getByRole('switch', { name: '2' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('spinbutton', { name: '3' }) as HTMLInputElement).value).toBe('3');
    expect((screen.getByRole('textbox', { name: 'Empty Array' }) as HTMLInputElement).value).toBe('No values');
    expect((screen.getByRole('textbox', { name: 'Empty Object' }) as HTMLInputElement).value).toBe('No values');
    expect((screen.getByRole('textbox', { name: 'Provider' }) as HTMLInputElement).value).toBe('fal-ai');
    expect((screen.getByRole('textbox', { name: 'Model' }) as HTMLInputElement).value).toBe('atlas/image-v1');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
    const configuration = screen.getByRole('region', { name: 'Saved media generation configuration' });
    expect(configuration.className).toContain('max-w-[538px]');
    expect(configuration.className).toContain('gap-[18px]');
    expect(configuration.className).toContain('pt-[38px]');
    expect(screen.getByRole('textbox', { name: 'Provider' }).parentElement?.className).toContain('grid-cols-[150px_minmax(0,360px)]');
  });

  it('uses one dialog shell for Preview and Inspection presentation', () => {
    const { rerender } = render(<MediaGenerationRequestDialog
      open
      onOpenChange={() => undefined}
      preview={preview()}
      prompt='Stone arch'
      tab='configuration'
      onPromptChange={() => undefined}
      onTabChange={() => undefined}
      updateAction={{ disabled: true, pending: false, onUpdate: () => undefined }}
    />);
    const previewDialog = screen.getByRole('dialog');
    const shellClassName = previewDialog.className;
    expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy();

    rerender(<MediaGenerationRequestDialog
      open
      onOpenChange={() => undefined}
      preview={{ ...preview(), documentPath: undefined, editable: false }}
      prompt='Stone arch'
      tab='configuration'
      onPromptChange={() => undefined}
      onTabChange={() => undefined}
    />);
    expect(screen.getByRole('dialog').className).toBe(shellClassName);
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
  });

  it('renders flat MediaCard reference images without filename copy', () => {
    render(<MediaGenerationRequestView
      preview={{
        ...preview(),
        references: [{
          kind: 'image',
          projectRelativePath: 'scenes/02/first-frame.png' as never,
          browserUrl: '/studio-api/projects/movie/generation-reference-file?path=scenes%2F02%2Ffirst-frame.png',
          available: true,
        }],
      }}
      prompt='Use @Image1.'
      tab='references'
      onPromptChange={() => undefined}
      onTabChange={() => undefined}
    />);

    expect(screen.getByRole('img', { name: 'scenes/02/first-frame.png' }).getAttribute('src')).toContain('generation-reference-file');
    expect(screen.queryByText('scenes/02/first-frame.png')).toBeNull();
    expect(document.querySelector('[data-media-card-presentation="overlay"]')).toBeTruthy();
  });

  it('preserves desktop dimensions, request navigation, and Update/Close-only actions', () => {
    render(<MediaGenerationPreviewDialog
      open
      session={{
        projectName: 'movie',
        eventId: 'event_1',
        previews: [preview(), { ...preview(), documentPath: 'tmp/operations/media-generation/second.json' as never, prompt: 'Second request' }],
      }}
      onOpenChange={() => undefined}
    />);
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('h-[760px]');
    expect(dialog.className).toContain('w-[1120px]');
    expect((screen.getByRole('button', { name: 'Update' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /generate/i })).toBeNull();
    expect(screen.getByText('1 / 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next generation request' }));
    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.getByLabelText('Media generation prompt').textContent).toContain('Second request');
  });
});

function preview(): MediaGenerationPreviewResource {
  return {
    kind: 'mediaGenerationPreview',
    documentPath: 'tmp/operations/media-generation/request.json' as never,
    provider: 'fal-ai',
    model: 'atlas/image-v1',
    mediaKind: 'image',
    prompt: 'Stone arch',
    references: [],
    configuration: { nested: [null, true, 3], emptyArray: [], emptyObject: {} },
    editable: true,
    diagnostics: [],
  };
}
