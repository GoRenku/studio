// @vitest-environment jsdom
import React from 'react';
import type { GenerationPreviewResource } from '@gorenku/studio-core/client';
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
        purpose: 'image.create',
        title: 'Image Create Preview',
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
      await screen.findByText('Image Create Generation Preview')
    ).toBeTruthy();
    expect(screen.getByText('Create a production reference image.')).toBeTruthy();
    expect(screen.queryByText('Image Create Preview')).toBeNull();
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
        purpose: 'image.create',
        title: 'Image Create Preview',
      })
    );
    expect(
      await screen.findByText('Image Create Generation Preview')
    ).toBeTruthy();

    await dispatchPreview(
      previewFixture({
        purpose: 'image.create',
        title: 'Image Create Preview',
      })
    );
    expect(await screen.findByText('Image Create Generation Preview')).toBeTruthy();
  });

  it('navigates ordered previews while preserving the selected tab and independent drafts', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreviews([
      previewFixture({
        purpose: 'image.create',
        title: 'First Preview',
        saved: true,
        authoredText: 'First prompt.',
      }),
      previewFixture({
        purpose: 'image.create',
        title: 'Second Preview',
        saved: true,
        authoredText: 'Second prompt.',
      }),
    ]);

    expect(await screen.findByText('1 / 2')).toBeTruthy();
    const previous = screen.getByRole('button', { name: 'Previous generation request' });
    const next = screen.getByRole('button', { name: 'Next generation request' });
    expect(previous.hasAttribute('disabled')).toBe(true);
    fireEvent.input(screen.getByRole('textbox', { name: 'Generation prompt' }), {
      target: { value: 'First unsaved draft.' },
    });
    await act(async () => selectTab('References'));
    fireEvent.click(next);

    expect(await screen.findByText('2 / 2')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'References' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByRole('button', { name: 'Next generation request' }).hasAttribute('disabled')).toBe(true);
    await act(async () => selectTab('Prompt'));
    fireEvent.input(screen.getByRole('textbox', { name: 'Generation prompt' }), {
      target: { value: 'Second unsaved draft.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Previous generation request' }));
    expect((screen.getByRole('textbox', { name: 'Generation prompt' }) as HTMLTextAreaElement).value).toBe('First unsaved draft.');
    fireEvent.click(screen.getByRole('button', { name: 'Next generation request' }));
    expect((screen.getByRole('textbox', { name: 'Generation prompt' }) as HTMLTextAreaElement).value).toBe('Second unsaved draft.');
  });

  it('keeps the single-preview surface free of request navigation', async () => {
    render(<GenerationPreviewDialogHost />);
    await dispatchPreview(previewFixture({ purpose: 'image.create', title: 'Only Preview' }));
    expect(await screen.findByText('Image Create Generation Preview')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Previous generation request' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Next generation request' })).toBeNull();
  });

  it('renders references and config without role, token, or payload fields', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'image.create',
        title: 'Image Create Preview',
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

    expect(await screen.findByText('Generation')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Model' })).toBeTruthy();
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

  it('keeps a saved external request editable without an empty model selector', async () => {
    const preview = previewFixture({
      purpose: 'location.sheet',
      title: 'Location Sheet Preview',
      referenceLabel: 'Production Lookbook Sheet',
      saved: true,
      authoredText: '## Goal\n\nCreate a readable Location Sheet.',
    });
    preview.model = {
      provider: 'codex',
      modelId: 'gpt-image-2',
      mediaKind: 'image',
      executionPath: 'agent-external',
    };
    preview.authoring.models = [];
    preview.configuration.sections = [
      {
        key: 'model',
        label: 'Model',
        rows: [{
          key: 'model',
          label: 'Model',
          value: 'codex/gpt-image-2',
          source: 'spec',
        }],
      },
      {
        key: 'inputs',
        label: 'Saved values',
        rows: [{
          key: 'quality',
          label: 'quality',
          value: 'high',
          source: 'spec',
        }],
      },
    ];

    render(<GenerationPreviewDialogHost />);
    await dispatchPreview(preview);

    expect(
      screen
        .getByRole('textbox', { name: 'Generation prompt' })
        .hasAttribute('readonly'),
    ).toBe(false);
    expect(screen.getByRole('button', { name: 'Update' })).toBeTruthy();

    await act(async () => selectTab('References'));
    expect(
      screen.getByRole('button', {
        name: 'Exclude Production Lookbook Sheet',
      }),
    ).toBeTruthy();

    await act(async () => selectTab('Config'));
    expect(screen.queryByRole('combobox', { name: 'Model' })).toBeNull();
    expect(screen.getByText('codex/gpt-image-2')).toBeTruthy();
    expect(screen.getByText('high')).toBeTruthy();
  });

  it('keeps the source reference fixed for saved image-edit previews', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'image.edit',
        title: 'Image Edit Preview',
        referenceLabel: 'Mara Character Sheet',
        saved: true,
      })
    );

    await act(async () => {
      selectTab('References');
    });

    expect(await screen.findByText('Mara Character Sheet')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Mara Character Sheet' }),
    ).toBeNull();
    expect(screen.queryByText('Additional Media')).toBeNull();
  });

  it('renders estimate in the dialog footer instead of the Config tab', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'image.create',
        title: 'Image Create Preview',
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

    const configPanel = screen.getByText('Generation').closest('[role="tabpanel"]');
    expect(configPanel?.textContent).not.toContain('Estimated total');
  });

  it('renders Core diagnostics as a banner without an Issues tab', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'image.create',
        title: 'Image Create Preview',
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
      await screen.findByText('Image Create Generation Preview')
    ).toBeTruthy();
    expect(screen.getByText('Generation Preview Notes')).toBeTruthy();
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('GENERATION_PREVIEW_TEST');
    expect(alert.textContent).toContain('The preview includes a warning from Core.');
    expect(alert.textContent).toContain('Review the warning before generating.');
    expect(screen.queryByRole('tab', { name: 'Issues' })).toBeNull();
    expect(screen.queryByText('No Issues')).toBeNull();
  });

  it('updates prompt and reference drafts together without closing the dialog', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        preview: previewFixture({
          purpose: 'cast.character-sheet',
          title: 'Character Sheet Preview',
          referenceLabel: 'Storyboard Lookbook Sheet',
          selected: false,
          editableReference: true,
          authoredText: 'Updated production prompt.\nSecond line.',
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

    fireEvent.input(
      await screen.findByRole('textbox', { name: 'Generation prompt' }),
      {
        target: { value: 'Updated production prompt.\nSecond line.' },
      },
    );
    expect(fetchMock).not.toHaveBeenCalled();

    await act(async () => {
      selectTab('References');
    });
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Exclude Storyboard Lookbook Sheet',
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('button', {
        name: 'Include Storyboard Lookbook Sheet',
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/studio-api/projects/constantinople/generation-previews/specs/generation_spec_test',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            prompt: {
              authoredText: 'Updated production prompt.\nSecond line.',
            },
            model: {
              provider: 'fal-ai',
              model: 'fal-ai/openai/gpt-image-2',
            },
            parameterValues: {
              image_size: 'landscape_16_9',
            },
            slotSelections: [
              {
                placement: {
                  kind: 'slot',
                  sectionId: 'visual-language',
                  slotId: 'lookbook',
                },
                reference: null,
              },
            ],
          }),
        })
      );
    });
    expect(screen.getByText('Character Sheet Generation Preview')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Update' }).hasAttribute('disabled'),
    ).toBe(true);

    fireEvent.click(screen.getAllByRole('button', { name: 'Close' }).at(-1)!);
    await waitFor(() => {
      expect(
        screen.queryByText('Character Sheet Generation Preview')
      ).toBeNull();
    });

    await dispatchPreview(
      previewFixture({
        purpose: 'image.create',
        title: 'Image Create Preview',
        referenceLabel: 'Reopened Storyboard Lookbook Sheet',
      })
    );
    expect(await screen.findByText('Image Create Generation Preview')).toBeTruthy();
    await act(async () => {
      selectTab('References');
    });
    expect(screen.getByText('Reopened Storyboard Lookbook Sheet')).toBeTruthy();
  });

  it('keeps the dialog open and shows structured update errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({
        error: { code: 'CORE_TEST', message: 'Preview update failed.' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'cast.character-sheet',
        title: 'Character Sheet Preview',
        editableReference: true,
      }),
    );
    fireEvent.input(
      await screen.findByRole('textbox', { name: 'Generation prompt' }),
      { target: { value: 'A failing update.' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    expect(await screen.findByText('Preview Update Failed')).toBeTruthy();
    expect(screen.getByText('CORE_TEST: Preview update failed.')).toBeTruthy();
    expect(screen.getByText('Character Sheet Generation Preview')).toBeTruthy();
  });

  it('keeps unsaved previews non-editable', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'image.create',
        title: 'Draft Preview',
      }),
    );
    expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
    expect(
      screen
        .getByRole('textbox', { name: 'Generation prompt' })
        .hasAttribute('readonly'),
    ).toBe(true);

  });

  it('shows a model-supported negative prompt in a smaller editor', async () => {
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'image.create',
        title: 'Image Create Preview',
        saved: true,
        negativeText: 'No camera shake.',
      })
    );

    const promptPanel = screen
      .getByRole('textbox', { name: 'Generation prompt' })
      .closest('[role="tabpanel"]')
      ?.firstElementChild;
    expect(promptPanel?.className).toContain(
      'grid-rows-[minmax(0,3fr)_minmax(0,1fr)]'
    );
    expect(
      (screen.getByRole('textbox', {
        name: 'Negative generation prompt',
      }) as HTMLTextAreaElement).value
    ).toBe('No camera shake.');
  });

  it('does not let a superseded update response replace a newer preview', async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<GenerationPreviewDialogHost />);

    await dispatchPreview(
      previewFixture({
        purpose: 'image.create',
        title: 'First Image Create Preview',
        saved: true,
        authoredText: 'First preview prompt.',
      })
    );
    fireEvent.input(
      screen.getByRole('textbox', { name: 'Generation prompt' }),
      { target: { value: 'Pending update prompt.' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    await dispatchPreview(
      previewFixture({
        purpose: 'image.create',
        title: 'Newer Image Create Preview',
        saved: true,
        authoredText: 'Newer preview prompt.',
      })
    );
    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({
          preview: previewFixture({
            purpose: 'image.create',
            title: 'Stale Image Create Preview',
            saved: true,
            authoredText: 'Stale response prompt.',
          }),
        }),
      } as Response);
    });

    await waitFor(() => {
      expect(
        (screen.getByRole('textbox', {
          name: 'Generation prompt',
        }) as HTMLTextAreaElement).value
      ).toBe('Newer preview prompt.');
    });
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

let previewEventSequence = 0;

async function dispatchPreview(preview: GenerationPreviewResource): Promise<void> {
  return dispatchPreviews([preview]);
}

async function dispatchPreviews(previews: GenerationPreviewResource[]): Promise<void> {
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent('renku:generation-preview-requested', {
        detail: {
          projectName: previews[0]!.project.name,
          previews,
          eventId: `studio_event_test_${++previewEventSequence}`,
          createdAt: '2026-07-02T10:00:00.000Z',
        },
      })
    );
  });
}

function previewFixture(input: {
  purpose: GenerationPreviewResource['purpose'];
  title: string;
  referenceLabel?: string;
  selected?: boolean;
  editableReference?: boolean;
  requiredReference?: boolean;
  saved?: boolean;
  authoredText?: string;
  negativeText?: string;
  providerPreview?: GenerationPreviewResource['providerPreview'];
  diagnostics?: GenerationPreviewResource['diagnostics'];
  estimate?: GenerationPreviewResource['estimate'];
}): GenerationPreviewResource {
  return {
    kind: 'generationPreview',
    previewId: 'generation_preview_test',
    generationSpecId: input.saved || input.editableReference
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
      kind: 'project',
      id: 'project',
    },
    title: input.title,
    model: {
      provider: 'fal-ai',
      modelId: 'fal-ai/openai/gpt-image-2',
      mediaKind: 'image',
      executionPath: 'renku-managed',
      route: 'image-to-image',
    },
    finalPrompt: {
      authoredText:
        input.authoredText ?? 'Create a production reference image.',
      providerText:
        input.authoredText ?? 'Create a production reference image.',
      ...(input.negativeText !== undefined
        ? { negativeText: input.negativeText }
        : {}),
    },
    references: {
      slots: [{
        label: 'Visual language',
        placement: {
          kind: 'slot',
          sectionId: 'visual-language',
          slotId: 'lookbook',
        },
        current: (input.selected ?? true) ? {
          kind: 'image',
          role: 'style',
          label: input.referenceLabel ?? 'Storyboard Lookbook Sheet',
          providerToken: '@Reference1',
          assetId: 'asset_style',
          assetFileId: 'asset_file_style',
          sourcePurpose: 'lookbook.storyboard-sheet',
          selected: true,
          browserUrl:
            '/studio-api/projects/constantinople/assets/asset_style/files/asset_file_style',
        } : null,
        eligibleCandidates: [{
          kind: 'image',
          role: 'style',
          label: input.referenceLabel ?? 'Storyboard Lookbook Sheet',
          providerToken: '@Reference1',
          assetId: 'asset_style',
          assetFileId: 'asset_file_style',
          sourcePurpose: 'lookbook.storyboard-sheet',
          selected: false,
          browserUrl:
            '/studio-api/projects/constantinople/assets/asset_style/files/asset_file_style',
        }],
      }],
      additional: [],
    },
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
    authoring: {
      models: [
        {
          provider: 'fal-ai',
          modelId: 'fal-ai/openai/gpt-image-2',
          label: 'GPT Image 2',
          controls: [
            {
              controlId: 'image_size',
              kind: 'select',
              label: 'Image size',
              value: 'landscape_16_9',
              required: false,
              authored: true,
              options: [
                { label: 'landscape_4_3', value: 'landscape_4_3' },
                { label: 'landscape_16_9', value: 'landscape_16_9' },
              ],
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
