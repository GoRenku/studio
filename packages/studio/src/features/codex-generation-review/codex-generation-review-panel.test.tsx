// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationReview, GenerationReviewDraft, GenerationReviewResponse } from '@gorenku/studio-codex/client';
import type { CodexGenerationReviewDisplayMode } from '@gorenku/studio-core/client';
import { CodexGenerationReviewPanel } from './codex-generation-review-panel';

const interaction = vi.hoisted(() => ({
  review: undefined as GenerationReview | undefined,
  drafts: [] as GenerationReviewDraft[], connected: true, busy: false,
  pendingResponse: undefined as GenerationReviewResponse | undefined,
  displayMode: 'inline' as CodexGenerationReviewDisplayMode,
  respond: vi.fn(), editPrompt: vi.fn(), editValue: vi.fn(),
  generateWithoutAsking: false, setGenerateWithoutAsking: vi.fn(),
  estimate: null as import('@gorenku/studio-core/client').GenerationCostEstimate | null,
  estimateFor: vi.fn(() => interaction.estimate), estimateRefreshing: vi.fn(() => false), estimateOutdated: vi.fn(() => false),
}));

vi.mock('./use-codex-generation-review', () => ({ useCodexGenerationReview: () => interaction }));
afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  interaction.connected = true;
  interaction.busy = false;
  interaction.pendingResponse = undefined;
  interaction.displayMode = 'inline';
  interaction.generateWithoutAsking = false;
  interaction.estimate = null;
  interaction.estimateFor.mockImplementation(() => interaction.estimate);
  interaction.estimateRefreshing.mockImplementation(() => false);
  interaction.estimateOutdated.mockImplementation(() => false);
  interaction.review = {
    reviewId: 'review', revision: 1, lane: 'video', phase: 'ready', diagnostics: [],
    requests: [{
      requestId: 'request', requestSha256: 'a'.repeat(64),
      routes: [{ provider: 'fal-ai', providerLabel: 'Fal.ai', model: 'video-model', label: 'Video model', mediaKind: 'video', billing: 'providerCharge' }],
      controls: { groups: [{ label: 'Video settings', fields: [
        { key: '/resolution', label: 'Resolution', kind: 'enum', options: [{ value: '768P', label: '768P' }, { value: '1080P', label: '1080P' }] },
        { key: '/duration', label: 'Duration (seconds)', kind: 'integer' },
        { key: '/aspect_ratio', label: 'Aspect ratio', kind: 'text' },
        { key: '/prompt_expansion_mode', label: 'Prompt expansion', kind: 'text' },
      ] }] },
      preview: {
        kind: 'mediaGenerationPreview', provider: 'fal-ai', model: 'video-model', mediaKind: 'video', prompt: 'Café', editable: true, diagnostics: [],
        configuration: { reference_image_urls: [], resolution: '768P', duration: 15, aspect_ratio: '16:9', prompt_expansion_mode: 'quality' },
        references: [{ requestPointer: '/reference_image_urls/0', referenceId: 'image', resourceUri: 'renku-reference://review/image', kind: 'image', reviewLabel: 'Opening frame', available: true }],
        requestSha256: 'a'.repeat(64), estimate: null,
      },
    }],
    drafts: [],
  };
  interaction.drafts = [{ requestId: 'request', prompt: 'Café', values: { '/resolution': '1080P', '/duration': 12, '/aspect_ratio': '16:9', '/prompt_expansion_mode': 'quality' } }];
});

function showConfiguration() {
  render(<CodexGenerationReviewPanel />);
  fireEvent.mouseDown(screen.getByRole('tab', { name: 'Configuration' }), { button: 0, ctrlKey: false });
}

describe('combined generation review configuration', () => {
  it.each(['retry', 'another model'])('allows %s after preparation failure while editing and Submit stay locked', (choice) => {
    const request = interaction.review!.requests[0]!;
    const failed = { ...request.routes[0]!, model: 'failed-model', label: 'Failed model' };
    const other = { ...failed, model: 'another-model', label: 'Another model' };
    request.routes.push(failed, other);
    interaction.review!.phase = 'preparationFailed';
    interaction.review!.pendingRoute = { requestId: request.requestId, route: failed };
    showConfiguration();

    const selector = screen.getByRole('combobox', { name: 'Provider and model' });
    expect((selector as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('spinbutton', { name: 'Duration (seconds)' }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Submit and generate' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(selector, { key: 'Enter' });
    const route = choice === 'retry' ? failed : other;
    fireEvent.click(screen.getByRole('option', { name: `Fal.ai · ${route.label}` }));
    expect(interaction.respond).toHaveBeenCalledWith('reconfigure', { requestId: request.requestId, route });
  });

  it.each(['preparing', 'submitted', 'cancelled'] as const)('locks model selection during %s', (phase) => {
    interaction.review!.phase = phase;
    render(<CodexGenerationReviewPanel />);
    expect((screen.getByRole('combobox', { name: 'Provider and model' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each(['disconnected', 'busy', 'pending response'])('locks recovery controls while %s', (condition) => {
    interaction.review!.phase = 'preparationFailed';
    interaction.review!.pendingRoute = { requestId: 'request', route: interaction.review!.requests[0]!.routes[0]! };
    interaction.connected = condition !== 'disconnected';
    interaction.busy = condition === 'busy';
    if (condition === 'pending response') interaction.pendingResponse = { reviewId: 'review', expectedRevision: 1, responseId: 'pending', action: 'reconfigure', drafts: interaction.drafts };
    render(<CodexGenerationReviewPanel />);
    expect((screen.getByRole('combobox', { name: 'Provider and model' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Return to the prepared model' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('bounds the inline review and fills the host viewport after switching to fullscreen', () => {
    const { rerender } = render(<CodexGenerationReviewPanel />);
    const review = screen.getByRole('region', { name: 'Generation review' });
    expect(review.className).toContain('h-[42rem]');
    expect(review.className).not.toContain('h-screen');
    interaction.displayMode = 'fullscreen';
    rerender(<CodexGenerationReviewPanel />);
    expect(review.className).toContain('h-screen');
    expect(review.className).not.toContain('h-[42rem]');
    expect(screen.getByRole('button', { name: 'Submit and generate' })).toBeTruthy();
  });

  it('shows edited settings once without stale saved values or repeated route/reference fields', () => {
    showConfiguration();
    expect(screen.getByRole('combobox', { name: 'Resolution' }).textContent).toBe('1080P');
    expect((screen.getByRole('spinbutton', { name: 'Duration (seconds)' }) as HTMLInputElement).value).toBe('12');
    expect(screen.queryByRole('textbox', { name: 'Resolution' })).toBeNull();
    expect(screen.queryByRole('spinbutton', { name: 'Duration' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Provider' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Model' })).toBeNull();
    expect(screen.queryByText('Reference Image Urls')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Saved media generation configuration' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Unset' })).toBeNull();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Duration (seconds)' }), { target: { value: '10' } });
    expect(interaction.editValue).toHaveBeenCalledWith('request', '/duration', 10);
  });

  it('retains only native configuration that has no editable control', () => {
    interaction.review!.requests[0]!.preview.configuration = { seed: 42, output: { width: 1920, height: 1080 } };
    interaction.review!.requests[0]!.controls.groups[0]!.fields.push({ key: '/output/width', label: 'Width', kind: 'integer' });
    interaction.drafts[0]!.values['/output/width'] = 1920;
    showConfiguration();
    expect(screen.getAllByRole('spinbutton', { name: 'Width' })).toHaveLength(1);
    expect((screen.getByRole('spinbutton', { name: 'Seed' }) as HTMLInputElement).value).toBe('42');
    expect((screen.getByRole('spinbutton', { name: 'Height' }) as HTMLInputElement).value).toBe('1080');
    expect(screen.queryByRole('textbox', { name: 'Provider' })).toBeNull();
  });

  it('shows the estimate with no dollar amount for an unknown price', () => {
    interaction.estimate = { state: 'missingPrice', amountUsd: null, basis: 'No price is known for this route', observedAt: null, sourceUrl: null, notes: [], requestSha256: 'a'.repeat(64) };
    render(<CodexGenerationReviewPanel />);
    const estimate = screen.getByRole('region', { name: 'Estimated cost' });
    expect(estimate.textContent).toContain('No price is known for this route');
    expect(estimate.textContent).not.toContain('$');
  });

  it('shows a computed estimate and host plan usage', () => {
    interaction.estimate = { state: 'computed', amountUsd: 1.68, basis: '10 seconds × $0.168', observedAt: '2026-10-12T00:00:00.000Z', sourceUrl: 'https://example.test/pricing', notes: [], requestSha256: 'a'.repeat(64) };
    render(<CodexGenerationReviewPanel />);
    expect(screen.getByRole('region', { name: 'Estimated cost' }).textContent).toContain('$1.68');
    cleanup();
    interaction.estimate = { state: 'hostPlanUsage', amountUsd: null, basis: 'Uses your ChatGPT plan\'s Codex usage', observedAt: null, sourceUrl: null, notes: [], requestSha256: 'a'.repeat(64) };
    render(<CodexGenerationReviewPanel />);
    expect(screen.getByRole('region', { name: 'Estimated cost' }).textContent).toContain('Uses your ChatGPT plan\'s Codex usage');
  });

  it('offers Generate without asking next time beside Submit', () => {
    render(<CodexGenerationReviewPanel />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Generate without asking next time' }));
    expect(interaction.setGenerateWithoutAsking).toHaveBeenCalledWith(true);
  });

  it('identifies a displayed estimate that no longer matches the edited draft', () => {
    interaction.estimate = { state: 'computed', amountUsd: 0.04, basis: 'Fixture price', observedAt: null, sourceUrl: null, notes: [], requestSha256: 'a'.repeat(64) };
    interaction.estimateOutdated.mockReturnValue(true);
    render(<CodexGenerationReviewPanel />);
    expect(screen.getByRole('region', { name: 'Estimated cost' }).textContent).toContain('Estimate outdated');
  });
});
