// @vitest-environment jsdom
import React from 'react';
import type { StudioGenerationPreview } from '@gorenku/studio-core/client';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GenerationPreviewDialogHost } from './generation-preview-dialog-host';

describe('GenerationPreviewDialogHost', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.__RENKU_STUDIO_BOOTSTRAP__ = {
      studioApiToken: 'studio-token-test',
    };
  });

  it('renders the redesigned prompt surface without the old debug chrome', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'shot.video-prompt-sheet',
        title: 'Prompt Sheet A',
        providerPreview: {
          provider: 'fal-ai',
          model: 'fal-ai/openai/gpt-image-2',
          providerTokenOrder: ['@Reference1'],
          payload: {
            prompt: 'provider payload prompt',
            image_url: 'provider-upload-url',
          },
        },
      })
    );

    expect(
      await screen.findByText('Shot Prompt Sheet Generation Preview')
    ).toBeTruthy();
    expect(screen.getByText('Create a motion annotated video prompt image.')).toBeTruthy();
    expect(screen.queryByText('Prompt Sheet A')).toBeNull();
    expect(screen.queryByText('Preparation of the Siege')).toBeNull();
    expect(screen.queryByText('Opening council')).toBeNull();
    expect(screen.queryByText('Take 1')).toBeNull();
    expect(screen.queryByText('Shot 1')).toBeNull();
    expect(screen.queryByText('fal-ai')).toBeNull();
    expect(screen.queryByText('fal-ai/openai/gpt-image-2')).toBeNull();
    expect(screen.queryByText('Provider Tokens')).toBeNull();
    expect(screen.queryByText('Provider Payload')).toBeNull();
    expect(screen.queryByText('@Reference1')).toBeNull();
    expect(screen.queryByText('provider-upload-url')).toBeNull();
    expect(screen.queryByText('No Issues')).toBeNull();

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Prompt',
      'References',
      'Config',
    ]);
    expect(screen.queryByRole('tab', { name: 'Issues' })).toBeNull();
  });

  it('maps every preview purpose to the exact visible dialog title', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'cast.character-sheet',
        title: 'Cast Preview',
      })
    );
    expect(
      await screen.findByText('Character Sheet Generation Preview')
    ).toBeTruthy();

    await dispatchPreview(
      previewFixture({
        purpose: 'shot.video-prompt-sheet',
        title: 'Prompt Sheet Preview',
      })
    );
    expect(
      await screen.findByText('Shot Prompt Sheet Generation Preview')
    ).toBeTruthy();

    await dispatchPreview(
      previewFixture({
        purpose: 'shot.video-take',
        title: 'Video Take Preview',
      })
    );
    expect(await screen.findByText('Shot Video Generation Preview')).toBeTruthy();
  });

  it('renders references and config without role, token, or payload fields', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'shot.video-prompt-sheet',
        title: 'Prompt Sheet A',
        referenceLabel: 'Storyboard Lookbook Sheet',
      })
    );

    await act(async () => {
      selectTab('References');
    });

    expect(await screen.findByText('Storyboard Lookbook Sheet')).toBeTruthy();
    expect(screen.getByAltText('Storyboard Lookbook Sheet').getAttribute('src')).toBe(
      '/studio-api/projects/constantinople/assets/asset_style/files/asset_file_style'
    );
    expect(screen.queryByText('Role')).toBeNull();
    expect(screen.queryByText('Token')).toBeNull();
    expect(screen.queryByText('Included')).toBeNull();
    expect(screen.queryByText('Excluded')).toBeNull();
    expect(screen.queryByText('IMAGE 1')).toBeNull();

    await act(async () => {
      selectTab('Config');
    });

    expect(await screen.findByText('Model inputs')).toBeTruthy();
    expect(await screen.findAllByText('Image size')).toHaveLength(1);
    expect(screen.getByText('landscape_16_9')).toBeTruthy();
    expect(screen.queryByText('IMAGE SIZE')).toBeNull();
    expect(screen.queryByText(/provider field:/)).toBeNull();
    expect(screen.queryByText(/provider default:/)).toBeNull();
    expect(screen.queryByText(/allowed:/)).toBeNull();
    expect(screen.queryByText(/source:/)).toBeNull();
    expect(screen.queryByText('Provider')).toBeNull();
    expect(screen.queryByText('Route')).toBeNull();
    expect(screen.queryByText('Execution path')).toBeNull();
    expect(screen.queryByText('Provider Payload')).toBeNull();
    expect(screen.queryByText('Reference count')).toBeNull();
    expect(screen.queryByText('Estimated total')).toBeNull();
  });

  it('renders estimate in the dialog footer instead of the Config tab', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'shot.video-prompt-sheet',
        title: 'Prompt Sheet A',
        estimate: {
          state: 'estimated',
          estimatedCostUsd: 0.12,
          warnings: ['Pricing may change before generation.'],
        },
      })
    );

    expect(await screen.findByText('Estimated total')).toBeTruthy();
    expect(screen.getByText('$0.12')).toBeTruthy();

    await act(async () => {
      selectTab('Config');
    });

    const configPanel = screen.getByText('Model inputs').closest('[role="tabpanel"]');
    expect(configPanel?.textContent).not.toContain('Estimated total');
  });

  it('renders Core diagnostics as a banner without an Issues tab', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'shot.video-take',
        title: 'Video Take Preview',
        diagnostics: [
          {
            severity: 'warning',
            code: 'GENERATION_PREVIEW_TEST',
            message: 'The preview includes a warning from Core.',
            location: { path: [] },
            suggestion: 'Review the warning before generating.',
          },
        ],
      })
    );

    expect(
      await screen.findByText('Shot Video Generation Preview')
    ).toBeTruthy();
    expect(screen.getByText('Generation Preview Notes')).toBeTruthy();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('GENERATION_PREVIEW_TEST');
    expect(alert.textContent).toContain('The preview includes a warning from Core.');
    expect(alert.textContent).toContain('Review the warning before generating.');
    expect(screen.queryByRole('tab', { name: 'Issues' })).toBeNull();
    expect(screen.queryByText('No Issues')).toBeNull();
  });

  it('updates editable reference inclusion and keeps later previews reopenable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        preview: previewFixture({
          purpose: 'cast.character-sheet',
          title: 'Character Sheet Preview',
          referenceLabel: 'Storyboard Lookbook Sheet',
          selected: false,
          editableReference: true,
        }),
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'cast.character-sheet',
        title: 'Character Sheet Preview',
        referenceLabel: 'Storyboard Lookbook Sheet',
        selected: true,
        editableReference: true,
      })
    );

    await act(async () => {
      selectTab('References');
    });
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Exclude Storyboard Lookbook Sheet',
      })
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/studio-api/projects/constantinople/generation-previews/specs/generation_spec_test/reference-inclusion',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            dependencyId: 'dependency_style',
            inclusion: 'exclude',
          }),
        })
      );
    });
    expect(
      await screen.findByRole('button', {
        name: 'Include Storyboard Lookbook Sheet',
      })
    ).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => {
      expect(
        screen.queryByText('Character Sheet Generation Preview')
      ).toBeNull();
    });

    await dispatchPreview(
      previewFixture({
        purpose: 'shot.video-take',
        title: 'Video Take Preview',
        referenceLabel: 'Reopened Storyboard Lookbook Sheet',
      })
    );
    expect(await screen.findByText('Shot Video Generation Preview')).toBeTruthy();
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

async function dispatchPreview(preview: StudioGenerationPreview): Promise<void> {
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent('renku:generation-preview-requested', {
        detail: {
          projectName: preview.project.name,
          preview,
          eventId: 'studio_event_test',
          createdAt: '2026-07-02T10:00:00.000Z',
        },
      })
    );
  });
}

function previewFixture(input: {
  purpose: StudioGenerationPreview['purpose'];
  title: string;
  referenceLabel?: string;
  selected?: boolean;
  editableReference?: boolean;
  providerPreview?: StudioGenerationPreview['providerPreview'];
  diagnostics?: StudioGenerationPreview['diagnostics'];
  estimate?: StudioGenerationPreview['estimate'];
}): StudioGenerationPreview {
  return {
    kind: 'generationPreview',
    previewId: 'generation_preview_test',
    generationSpecId: input.editableReference
      ? 'generation_spec_test'
      : undefined,
    purpose: input.purpose,
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
      castMemberLabel: 'Valeria',
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
      route: 'image-to-image',
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
        selected: input.selected ?? true,
        selectionControl: input.editableReference
          ? {
              dependencyId: 'dependency_style',
              required: false,
              defaultIncluded: true,
              inclusionOverride: null,
              editable: true,
            }
          : undefined,
        browserUrl:
          '/studio-api/projects/constantinople/assets/asset_style/files/asset_file_style',
      },
    ],
    configuration: {
      sections: [
        {
          key: 'model-inputs',
          label: 'Model inputs',
          rows: [
            {
              key: 'image_size',
              label: 'Image size',
              value: 'landscape_16_9',
              providerField: 'image_size',
              schemaDefault: 'landscape_4_3',
              schemaDefaultLabel: 'landscape_4_3',
              allowedValues: ['landscape_4_3', 'landscape_16_9'],
              required: false,
              source: 'spec',
              presentation: 'parameter-control',
            },
          ],
        },
      ],
    },
    providerPreview: input.providerPreview,
    estimate: input.estimate,
    diagnostics: input.diagnostics ?? [],
  };
}
