// @vitest-environment jsdom
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { GenerationPreviewResource } from '@gorenku/studio-core/client';
import { Button } from '@/ui/button';
import {
  GenerationRequestInspectorProvider,
} from './generation-request-inspector-provider';
import { useGenerationRequestInspectorDialog } from './use-generation-request-inspector';

const readAssetFileGenerationRequest = vi.hoisted(() => vi.fn());

vi.mock('@/services/studio-generation-requests-api', () => ({
  readAssetFileGenerationRequest,
}));

describe('Generation Request inspector', () => {
  it('shows the exact saved request with read-only references and static config', async () => {
    readAssetFileGenerationRequest.mockResolvedValue(previewFixture());
    render(
      <GenerationRequestInspectorProvider>
        <OpenInspector />
      </GenerationRequestInspectorProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open inspector' }));
    expect(readAssetFileGenerationRequest).toHaveBeenCalledWith({
      projectName: 'constantinople',
      assetId: 'asset_test',
      assetFileId: 'asset_file_test',
    });

    expect(await screen.findByRole('dialog')).not.toBeNull();
    expect(screen.getByText('Generation Request')).not.toBeNull();
    const prompt = await screen.findByRole('textbox', { name: 'Generation prompt' });
    expect(prompt.getAttribute('aria-readonly')).toBe('true');
    expect(prompt.textContent).toBe('Keep this exact authored prompt.');
    prompt.focus();
    fireEvent.keyDown(prompt, { key: 'x' });
    fireEvent.paste(prompt, {
      clipboardData: { getData: () => 'changed' },
    });
    expect(document.activeElement).toBe(prompt);
    expect(prompt.textContent).toBe('Keep this exact authored prompt.');

    const referencesTab = screen.getByRole('tab', { name: 'References' });
    activateTab(referencesTab);
    await waitFor(() => expect(referencesTab.getAttribute('aria-selected')).toBe('true'));
    expect(screen.getByAltText('Saved project reference')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Choose|Include|Exclude/ })).toBeNull();

    const configTab = screen.getByRole('tab', { name: 'Config' });
    activateTab(configTab);
    await waitFor(() => expect(configTab.getAttribute('aria-selected')).toBe('true'));
    expect(screen.getByText('GPT Image 2')).not.toBeNull();
    expect(screen.getByText('Landscape · 4:3')).not.toBeNull();
    expect(screen.queryByText('fal-ai/openai/gpt-image-2/edit')).toBeNull();
    expect(screen.queryByText('landscape_4_3')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Saved values' })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/Regenerate|Estimate|Update|Generate|Edit/)).toBeNull();

    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps loading and structured read errors inside the closable dialog', async () => {
    let rejectRequest: (reason: Error) => void = () => {};
    readAssetFileGenerationRequest.mockReturnValue(new Promise((_, reject) => {
      rejectRequest = reject;
    }));
    render(
      <GenerationRequestInspectorProvider>
        <OpenInspector />
      </GenerationRequestInspectorProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open inspector' }));

    expect(await screen.findByText('Loading generation request...')).not.toBeNull();
    await act(async () => rejectRequest(new Error('Saved request is unavailable.')));
    expect(await screen.findByText('Saved request is unavailable.')).not.toBeNull();
    expect(screen.queryByText(/Regenerate|Estimate|Update|Generate|Edit/)).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('does not show a stale request when the exact AssetFile changes', async () => {
    let resolveFirst: (preview: GenerationPreviewResource) => void = () => {};
    let resolveSecond: (preview: GenerationPreviewResource) => void = () => {};
    readAssetFileGenerationRequest.mockImplementation(
      (input: { assetFileId: string }) => new Promise((resolve) => {
        if (input.assetFileId === 'asset_file_first') {
          resolveFirst = resolve;
        } else {
          resolveSecond = resolve;
        }
      }),
    );
    render(
      <GenerationRequestInspectorProvider>
        <SwitchInspector />
      </GenerationRequestInspectorProvider>,
    );
    const openSecond = screen.getByRole('button', { name: 'Open second' });
    fireEvent.click(screen.getByRole('button', { name: 'Open first' }));
    fireEvent.click(openSecond);

    await act(async () => resolveSecond(previewFixture('Second exact prompt.')));
    const prompt = await screen.findByRole('textbox', { name: 'Generation prompt' });
    await waitFor(() => expect(prompt.textContent).toBe('Second exact prompt.'));
    await act(async () => resolveFirst(previewFixture('Stale first prompt.')));
    expect(prompt.textContent).toBe('Second exact prompt.');
  });

  it('closes through Escape, outside click, and the header close control', async () => {
    readAssetFileGenerationRequest.mockResolvedValue(previewFixture());
    render(
      <GenerationRequestInspectorProvider>
        <OpenInspector />
      </GenerationRequestInspectorProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open inspector' }));
    expect(await screen.findByRole('dialog')).not.toBeNull();
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Open inspector' }));
    expect(await screen.findByRole('dialog')).not.toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[1]!);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Open inspector' }));
    expect(await screen.findByRole('dialog')).not.toBeNull();
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    if (!overlay) {
      throw new Error('Expected the dialog overlay.');
    }
    fireEvent.pointerDown(overlay);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

function OpenInspector() {
  const { openGenerationRequestInspector } = useGenerationRequestInspectorDialog();
  return (
    <Button
      type='button'
      onClick={() => openGenerationRequestInspector({
        projectName: 'constantinople',
        assetId: 'asset_test',
        assetFileId: 'asset_file_test',
      })}
    >
      Open inspector
    </Button>
  );
}

function SwitchInspector() {
  const { openGenerationRequestInspector } = useGenerationRequestInspectorDialog();
  return (
    <>
      <Button
        type='button'
        onClick={() => openGenerationRequestInspector({
          projectName: 'constantinople',
          assetId: 'asset_first',
          assetFileId: 'asset_file_first',
        })}
      >
        Open first
      </Button>
      <Button
        type='button'
        onClick={() => openGenerationRequestInspector({
          projectName: 'constantinople',
          assetId: 'asset_second',
          assetFileId: 'asset_file_second',
        })}
      >
        Open second
      </Button>
    </>
  );
}

function activateTab(tab: HTMLElement) {
  fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
  fireEvent.pointerUp(tab, { button: 0, ctrlKey: false });
  fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
  fireEvent.mouseUp(tab, { button: 0, ctrlKey: false });
  fireEvent.click(tab);
}

function previewFixture(
  authoredText = 'Keep this exact authored prompt.',
): GenerationPreviewResource {
  return {
    kind: 'generationPreview',
    previewId: 'generation_preview_test',
    purpose: 'location.sheet',
    project: { id: 'project_test', name: 'constantinople' },
    target: { kind: 'location', id: 'location_test' },
    title: 'Ignored resource title',
    subject: { projectLabel: 'Constantinople' },
    model: {
      provider: 'fal-ai',
      modelId: 'openai/gpt-image-2/edit',
      executionPath: 'renku-managed',
      mediaKind: 'image',
    },
    finalPrompt: {
      authoredText,
      providerText: authoredText,
    },
    references: {
      slots: [{
        label: 'Research image',
        locked: false,
        placement: {
          kind: 'slot',
          sectionId: 'research',
          slotId: 'image',
        },
        current: {
          kind: 'image',
          role: 'project-file',
          label: 'Saved project reference',
          identity: { kind: 'project-file' },
          selected: true,
          browserUrl: '/studio-api/projects/constantinople/generation-reference-file?path=research%2Fhelmet.jpg',
        },
        eligibleCandidates: [],
      }],
      additional: [],
    },
    configuration: {
      sections: [{
        key: 'model',
        label: 'Model',
        rows: [{
          key: 'model',
          label: 'Model',
          value: 'fal-ai/openai/gpt-image-2/edit',
          valueLabel: 'GPT Image 2',
          source: 'spec',
        }],
      }, {
        key: 'saved-values',
        label: 'Saved values',
        rows: [{
          key: 'aspect_ratio',
          label: 'Image size',
          value: 'landscape_4_3',
          valueLabel: 'Landscape · 4:3',
          source: 'spec',
        }],
      }],
    },
    authoring: { selectedModelFamilyId: '', modelFamilies: [], controls: [] },
    diagnostics: [],
  };
}
