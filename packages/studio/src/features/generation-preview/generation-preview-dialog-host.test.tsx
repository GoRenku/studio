// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GenerationPreviewDialogHost } from './generation-preview-dialog-host';

describe('GenerationPreviewDialogHost', () => {
  it('opens, updates in place, preserves the selected tab, and reopens after dismissal', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(previewFixture({ title: 'Prompt Sheet A' }), {
      eventId: 'studio_event_001',
      createdAt: '2026-07-02T10:00:00.000Z',
    });

    expect(await screen.findByText('Prompt Sheet A')).toBeTruthy();
    expect(screen.getByText('Preparation of the Siege')).toBeTruthy();
    expect(screen.getByText('Opening council')).toBeTruthy();
    expect(screen.getByText('Take 1')).toBeTruthy();
    expect(screen.getByText('Shot 1')).toBeTruthy();
    expect(screen.queryByText('scene_test0001')).toBeNull();
    expect(screen.queryByText('take_test0001')).toBeNull();
    expect(screen.queryByText('shot_test0001')).toBeNull();
    expect(screen.getByText('Visual Style')).toBeTruthy();
    expect(screen.getByText('motion-annotation')).toBeTruthy();
    await act(async () => {
      selectTab('References');
    });
    expect(await screen.findByText('Storyboard Lookbook Sheet')).toBeTruthy();
    expect(screen.getByAltText('Storyboard Lookbook Sheet').getAttribute('src')).toBe(
      '/studio-api/projects/constantinople/assets/asset_style/files/asset_file_style'
    );

    await dispatchPreview(
      previewFixture({
        title: 'Prompt Sheet B',
        referenceLabel: 'Revised Storyboard Lookbook Sheet',
      }),
      {
        eventId: 'studio_event_002',
        createdAt: '2026-07-02T10:01:00.000Z',
      }
    );

    expect(await screen.findByText('Prompt Sheet B')).toBeTruthy();
    expect(screen.getByText('Revision 2')).toBeTruthy();
    expect(screen.getByText('Revised Storyboard Lookbook Sheet')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => {
      expect(screen.queryByText('Prompt Sheet B')).toBeNull();
    });

    await dispatchPreview(
      previewFixture({
        title: 'Prompt Sheet C',
        referenceLabel: 'Reopened Storyboard Lookbook Sheet',
      }),
      {
        eventId: 'studio_event_003',
        createdAt: '2026-07-02T10:02:00.000Z',
      }
    );

    expect(await screen.findByText('Prompt Sheet C')).toBeTruthy();
    expect(screen.getByText('Revision 3')).toBeTruthy();
    expect(screen.getByText('Reopened Storyboard Lookbook Sheet')).toBeTruthy();
  });
});

function selectTab(name: string): void {
  const tab = screen.getByRole('tab', { name });
  tab.focus();
  fireEvent.keyDown(tab, { key: 'Enter', code: 'Enter' });
  fireEvent.keyUp(tab, { key: 'Enter', code: 'Enter' });
  fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
  fireEvent.pointerUp(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
}

async function dispatchPreview(
  preview: ReturnType<typeof previewFixture>,
  event: { eventId: string; createdAt: string }
): Promise<void> {
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent('renku:generation-preview-requested', {
        detail: {
          projectName: preview.project.name,
          preview,
          eventId: event.eventId,
          createdAt: event.createdAt,
        },
      })
    );
  });
}

function previewFixture(input: {
  title: string;
  referenceLabel?: string;
}) {
  return {
    kind: 'generationPreview',
    previewId: 'generation_preview_test',
    purpose: 'shot.video-prompt-sheet',
    project: {
      id: 'project_test0001',
      name: 'constantinople',
      title: 'Preparation of the Siege',
    },
    subject: {
      projectLabel: 'Preparation of the Siege',
      sceneLabel: 'Opening council',
      takeLabel: 'Take 1',
      shotLabel: 'Shot 1',
    },
    target: {
      kind: 'sceneShotVideoTake',
      id: 'take_test0001',
      sceneId: 'scene_test0001',
      takeId: 'take_test0001',
      shotIds: ['shot_test0001'],
    },
    title: input.title,
    model: {
      provider: 'fal-ai',
      modelId: 'fal-ai/openai/gpt-image-2',
      mediaKind: 'image',
      executionPath: 'renku-managed',
    },
    promptSheetVisualStyleId: 'handdrawn-storyboard',
    promptSheetNotationModeId: 'motion-annotation',
    finalPrompt: {
      text: 'Create a motion annotated video prompt image.',
    },
    references: [
      {
        kind: 'image',
        role: 'style',
        label: input.referenceLabel ?? 'Storyboard Lookbook Sheet',
        providerToken: '@Reference1',
        assetId: 'asset_style',
        assetFileId: 'asset_file_style',
        sourcePurpose: 'lookbook.sheet',
        selected: true,
        browserUrl:
          '/studio-api/projects/constantinople/assets/asset_style/files/asset_file_style',
      },
    ],
    configuration: [
      {
        key: 'image_size',
        label: 'Image size',
        value: '1024x768',
      },
    ],
    diagnostics: [],
  };
}
