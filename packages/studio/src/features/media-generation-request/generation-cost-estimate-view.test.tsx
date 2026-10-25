// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { GenerationCostEstimate } from '@gorenku/studio-core/client';
import { GenerationCostEstimateView } from './generation-cost-estimate-view';

afterEach(cleanup);

function estimate(overrides: Partial<GenerationCostEstimate>): GenerationCostEstimate {
  return { state: 'computed', amountUsd: 0.84, basis: '5 seconds × $0.168', observedAt: null, sourceUrl: null, notes: [], requestSha256: 'a'.repeat(64), ...overrides };
}

describe('GenerationCostEstimateView', () => {
  it.each([
    ['computed', { state: 'computed', amountUsd: 12.5 }, '$12.50'],
    ['missing', { state: 'missingPrice', amountUsd: null }, 'No price is known for this route'],
    ['unpriced', { state: 'unpriced', amountUsd: null, basis: 'No video price tier matches this request.' }, 'No video price tier matches this request.'],
    ['host plan', { state: 'hostPlanUsage', amountUsd: null, basis: 'Uses your ChatGPT plan\'s Codex usage' }, 'Uses your ChatGPT plan\'s Codex usage'],
  ] as const)('shows the %s state', (_name, overrides, text) => {
    render(<GenerationCostEstimateView estimate={estimate(overrides)} />);
    const region = screen.getByRole('region', { name: 'Estimated cost' });
    expect(region.textContent).toContain(text);
    if (overrides.amountUsd === null) expect(region.textContent).not.toContain('$');
  });

  it('marks an outdated estimate and links its source', () => {
    render(<GenerationCostEstimateView estimate={estimate({ sourceUrl: 'https://example.test/pricing', notes: ['Base price only.'] })} outdated />);
    expect(screen.getByText('Estimate outdated')).toBeTruthy();
    expect(screen.getByText('Base price only.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Price source' }).getAttribute('href')).toBe('https://example.test/pricing');
  });

  it('renders nothing without an estimate', () => {
    const { container } = render(<GenerationCostEstimateView estimate={null} />);
    expect(container.textContent).toBe('');
  });
});
