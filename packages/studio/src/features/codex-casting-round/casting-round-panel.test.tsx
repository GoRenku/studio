// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hostPlanUsageEstimate, type GenerationCostEstimate } from '@gorenku/studio-core/client';
import type { CastingRound, CastingRoundRespondInput } from '@gorenku/studio-codex/casting-round';
import { CastingRoundPanel } from './casting-round-panel';
import { clampTotal, splitTotal } from './round-counts';

const integration = vi.hoisted(() => ({
  bridge: { app: { ontoolresult: undefined as ((result: object) => void) | undefined, onteardown: undefined as unknown, close: vi.fn(), readServerResource: vi.fn() }, extensions: {} },
  round: undefined as unknown,
  connect: vi.fn(), respond: vi.fn(), notify: vi.fn(),
}));

vi.mock('@/services/codex-casting-round', () => ({
  createCastingRoundApp: () => integration.bridge,
  connectCastingRoundApp: integration.connect,
  respondToCastingRound: integration.respond,
  notifyCastingRound: integration.notify,
}));

beforeEach(() => {
  vi.clearAllMocks();
  integration.connect.mockImplementation(async () => {
    integration.bridge.app.ontoolresult!({ content: [], structuredContent: { round: integration.round } });
  });
  integration.respond.mockImplementation(async (_bridge, input: CastingRoundRespondInput) => ({
    ...(integration.round as CastingRound),
    revision: 2,
    answer: input.choice.kind === 'canceled'
      ? input.choice
      : { ...input.choice, estimatedCost: { amount: 0.3, currency: 'USD' }, castingDefaultsSaved: input.saveAsCastingDefaults },
  }));
  integration.notify.mockResolvedValue(undefined);
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const portrait = { key: 'acme-portrait', name: 'Acme Portrait' };
const faces = { key: 'acme-faces', name: 'Acme Faces' };
const host = { key: 'acme-host-image', name: 'Acme Host Image' };
const estimate: GenerationCostEstimate = {
  state: 'computed', amountUsd: 0.04, basis: 'Fixture', observedAt: '2026-10-24T00:00:00.000Z', sourceUrl: null, notes: [], requestSha256: 'request',
};

/** The same estimate at every detail level. */
const atEveryLevel = (value: GenerationCostEstimate) => ({ lowest: value, mid: value, highest: value });

// Fictional routes only: the panel renders whatever models and prices the round lists.
function roundFixture(overrides: Partial<CastingRound> = {}): CastingRound {
  return {
    panelId: 'panel',
    revision: 1,
    castMember: { id: 'cast_1', name: 'Ana' },
    look: { id: 'look_1', name: 'Young' },
    brief: ['A girl of about 16', 'Neutral backdrop'],
    references: [],
    options: [
      { model: portrait, note: 'Wide range of faces', providers: [
        { provider: 'acme-cloud', providerLabel: 'Acme Cloud', estimates: atEveryLevel({ ...estimate }) },
        { provider: 'acme-alt', providerLabel: 'Acme Alt', estimates: atEveryLevel({ ...estimate, amountUsd: 0.03 }) },
      ] },
      { model: faces, note: null, providers: [{ provider: 'acme-cloud', providerLabel: 'Acme Cloud', estimates: atEveryLevel({ ...estimate, amountUsd: 0.02 }) }] },
      { model: host, note: null, providers: [{ provider: 'acme-host', providerLabel: 'Acme Host', estimates: atEveryLevel(hostPlanUsageEstimate(null)) }] },
    ],
    preselected: [{ provider: 'acme-cloud', model: portrait, count: 10 }],
    initialTotal: 10,
    maxCountPerModel: 50,
    maxConcurrentGenerations: 4,
    initialDetail: 'lowest',
    answer: null,
    ...overrides,
  };
}

async function openRound(overrides: Partial<CastingRound> = {}) {
  integration.round = roundFixture(overrides);
  render(<CastingRoundPanel />);
  await screen.findByRole('heading', { name: 'Casting round' });
}

const totalValue = () => screen.getByRole('group', { name: 'Candidates' }).querySelector('output')!.textContent;

describe('round counts', () => {
  it('splits the total evenly with the remainder on the first models', () => {
    expect(splitTotal(10, ['a', 'b', 'c'])).toEqual({ a: 4, b: 3, c: 3 });
    expect(splitTotal(4, [])).toEqual({});
  });

  it('keeps at least one candidate per ticked model and no more than the limit', () => {
    expect(clampTotal(1, 3, 50)).toBe(3);
    expect(clampTotal(200, 2, 50)).toBe(100);
    expect(clampTotal(0, 0, 50)).toBe(1);
  });
});

describe('Casting round panel', () => {
  it('shows the brief, notes, prices and the estimate for the preselected model', async () => {
    await openRound();
    expect(screen.getByText('Ana · Young')).toBeTruthy();
    expect(screen.getByText('A girl of about 16')).toBeTruthy();
    expect(screen.getByText('Wide range of faces')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Acme Portrait provider' }).textContent).toContain('Acme Cloud · $0.04 each');
    expect(screen.getByText('$0.02')).toBeTruthy();
    expect(screen.getByText('Uses your ChatGPT plan\'s Codex usage')).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: 'Acme Portrait' })).toHaveLength(1);
    expect(totalValue()).toBe('10');
    expect(screen.getByText('$0.40')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ask agent to generate 10' })).toBeTruthy();
  });

  it('shows the existing estimate warnings and source for the picked provider', async () => {
    const round = roundFixture();
    round.options[0]!.providers[0]!.estimates = atEveryLevel({ ...estimate, notes: ['Base price only; output settings can change the charge.'], sourceUrl: 'https://example.test/pricing' });
    await openRound({ options: round.options });
    expect(screen.getByText('Base price only; output settings can change the charge.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Price source' }).getAttribute('href')).toBe('https://example.test/pricing');
  });

  it('keeps an unestimated provider selectable without showing a known total', async () => {
    const round = roundFixture();
    round.options[0]!.providers[0]!.estimates = atEveryLevel({ ...estimate, state: 'missingPrice', amountUsd: null, basis: 'No price is known for this route' });
    await openRound({ options: round.options });
    expect(screen.getByText('No estimate for Acme Portrait')).toBeTruthy();
    expect(screen.queryByText('$0.40')).toBeNull();
    expect(screen.getByRole('button', { name: 'Ask agent to generate 10' })).toHaveProperty('disabled', false);
  });

  it('distinguishes host plan usage from a missing provider estimate', async () => {
    await openRound({ preselected: [{ provider: 'acme-host', model: host, count: 10 }] });
    expect(screen.getByText('Uses your ChatGPT plan instead of a provider charge')).toBeTruthy();
    expect(screen.queryByText('No estimate for Acme Host Image')).toBeNull();
  });

  it('splits the total across ticked models and lets per-model counters move the total', async () => {
    await openRound();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acme Faces' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acme Host Image' }));
    expect(screen.getByRole('group', { name: 'Acme Portrait' }).textContent).toContain('4');
    expect(screen.getByRole('group', { name: 'Acme Faces' }).textContent).toContain('3');
    expect(screen.getByRole('group', { name: 'Acme Host Image' }).textContent).toContain('3');
    fireEvent.click(screen.getByRole('button', { name: 'More · Acme Faces' }));
    expect(totalValue()).toBe('11');
    fireEvent.click(screen.getByRole('button', { name: 'Fewer · Candidates' }));
    expect(totalValue()).toBe('10');
    expect(screen.getByText('Acme Portrait $0.16 · Acme Faces $0.06')).toBeTruthy();
  });

  it('sends the ticked models and counts, saves defaults only when ticked and posts a neutral notice', async () => {
    await openRound();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acme Faces' }));
    fireEvent.click(screen.getByRole('checkbox', { name: "Save these models, counts and detail as this project's casting defaults" }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ask agent to generate 10' })); });
    expect(integration.respond).toHaveBeenCalledWith(integration.bridge, {
      panelId: 'panel',
      choice: { kind: 'generate', maxConcurrentGenerations: 4, detail: 'lowest', routes: [
        { provider: 'acme-cloud', model: portrait, count: 5 },
        { provider: 'acme-cloud', model: faces, count: 5 },
      ] },
      saveAsCastingDefaults: true,
    });
    expect(integration.notify.mock.calls[0]![2]).toBe('10 candidates on 2 models, lowest detail, 4 at a time · estimated $0.30');
  });

  it('opens on the project candidate detail and prices and sends the level the director picks', async () => {
    const round = roundFixture({ initialDetail: 'mid' });
    round.options[0]!.providers[0]!.estimates = { lowest: { ...estimate, amountUsd: 0.066 }, mid: { ...estimate, amountUsd: 0.139 }, highest: { ...estimate, amountUsd: 0.205 } };
    await openRound(round);
    expect(screen.getByRole('radio', { name: 'Mid' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText('$1.39')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Highest' }));
    expect(screen.getByText('$2.05')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ask agent to generate 10' })); });
    expect(integration.respond.mock.calls[0]![1]).toMatchObject({ choice: { detail: 'highest' } });
  });

  it('opens each model on its preselected provider and prices and sends that provider', async () => {
    await openRound({ preselected: [{ provider: 'acme-alt', model: portrait, count: 10 }] });
    expect(screen.getByRole('combobox', { name: 'Acme Portrait provider' }).textContent).toContain('Acme Alt · $0.03 each');
    expect(screen.getByText('$0.30')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ask agent to generate 10' })); });
    expect(integration.respond.mock.calls[0]![1]).toMatchObject({ choice: { routes: [{ provider: 'acme-alt', model: portrait, count: 10 }] } });
  });

  it('keeps the total when the last model is unticked and disables generate', async () => {
    await openRound();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Acme Portrait' }));
    expect(totalValue()).toBe('10');
    expect(screen.getByRole('button', { name: 'Ask agent to generate 10' })).toHaveProperty('disabled', true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Cancel' })); });
    expect(integration.respond.mock.calls[0]![1]).toMatchObject({ choice: { kind: 'canceled' } });
    expect(screen.getByText('Casting round canceled.')).toBeTruthy();
  });
});
