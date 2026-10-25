import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createFakeCostEstimator } from '../testing/fake-cost-estimator.js';
import { createCastingFixture, type CastingFixture } from '../testing/casting-fixture.js';
import type { CastingRound, CastingRoundConsumeResult } from './contracts.js';

const estimator = createFakeCostEstimator(0.05);
let fixture: CastingFixture;

beforeAll(async () => {
  fixture = await createCastingFixture({ estimator });
});

afterAll(async () => {
  await fixture?.close();
});

async function open(input: Record<string, unknown> = {}): Promise<CastingRound> {
  return (await fixture.call<{ round: CastingRound }>('casting.round.open', {
    project: 'movie', lookId: fixture.looks.young.id, brief: ['A girl of about 16', 'Neutral backdrop'], ...input,
  })).round;
}

describe('Casting round panel', () => {
  beforeEach(async () => {
    estimator.calls.length = 0;
    await fixture.service.setCastingSettings({ homeDir: fixture.homeDir, projectName: 'movie', casting: { routes: [], candidateDetail: 'lowest', characterSheetDetail: 'highest' } });
    await fixture.service.updateGenerationLaneSettings({ homeDir: fixture.homeDir, projectName: 'movie', lane: 'image', provider: 'fal-ai', model: null, chooseRouteBeforeGenerating: true });
  });

  it('exposes respond only to the app and open and consume to the model', async () => {
    const tools = (await fixture.client.listTools()).tools.filter((tool) => tool.name.startsWith('casting.round.'));
    expect(Object.fromEntries(tools.map((tool) => [tool.name, (tool._meta?.ui as { visibility?: string[] }).visibility]))).toEqual({
      'casting.round.open': ['model'],
      'casting.round.respond': ['app'],
      'casting.round.consume': ['model'],
    });
  });

  it('offers one option per model with its providers with saved keys, notes and per-image prices', async () => {
    const round = await open({ notes: { 'acme-portrait': 'Wide range of faces' } });
    expect(round.castMember.name).toBe('Ana Komnene');
    expect(round.look).toEqual({ id: fixture.looks.young.id, name: 'Young' });
    expect(round.initialDetail).toBe('lowest');
    expect(round.options.map((option) => [option.model.key, option.providers.map((entry) => [entry.provider, entry.estimates.lowest.state])])).toEqual([
      ['acme-portrait', [['fal-ai', 'computed'], ['replicate', 'computed']]],
      ['acme-faces', [['fal-ai', 'computed']]],
      ['acme-host-image', [['codex', 'hostPlanUsage']]],
    ]);
    expect(round.options[0]).toMatchObject({ note: 'Wide range of faces', providers: [{ providerLabel: expect.any(String), estimates: { lowest: { amountUsd: 0.05 }, highest: { amountUsd: 0.05 } } }, {}] });
    expect(round.options[1]!.note).toBeNull();
    expect(estimator.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'fal-ai', model: 'route/acme-portrait', fields: { size: 'small' }, requestSha256: null }),
      expect.objectContaining({ provider: 'fal-ai', model: 'route/acme-portrait', fields: { size: 'large' }, requestSha256: null }),
      expect.objectContaining({ provider: 'replicate', model: 'route/acme-portrait', requestSha256: null }),
      expect.objectContaining({ provider: 'fal-ai', model: 'route/acme-faces', requestSha256: null }),
    ]));
    expect(round.options[0]!.providers[1]!.estimates.mid.amountUsd).toBe(0.05);
    expect(round.maxConcurrentGenerations).toBeGreaterThan(0);
  });

  it('lists the image lane provider first for each model', async () => {
    await fixture.service.updateGenerationLaneSettings({ homeDir: fixture.homeDir, projectName: 'movie', lane: 'image', provider: 'replicate' });
    const round = await open();
    expect(round.options[0]!.providers.map((entry) => entry.provider)).toEqual(['replicate', 'fal-ai']);
    expect(round.preselected).toEqual([{ provider: 'replicate', model: { key: 'acme-portrait', name: 'Acme Portrait' }, count: 10 }]);
  });

  it('preselects the image lane default with the whole default total', async () => {
    const round = await open();
    expect(round.preselected).toEqual([{ provider: 'fal-ai', model: { key: 'acme-portrait', name: 'Acme Portrait' }, count: 10 }]);
    expect(round.initialTotal).toBe(10);
  });

  it('preselects the casting defaults, and the agent suggestion over them', async () => {
    await fixture.service.setCastingSettings({ homeDir: fixture.homeDir, projectName: 'movie', casting: { routes: [{ provider: 'fal-ai', model: { key: 'acme-faces', name: 'Acme Faces' }, count: 3 }], candidateDetail: 'mid', characterSheetDetail: 'highest' } });
    const fromDefaults = await open();
    expect(fromDefaults.preselected).toEqual([{ provider: 'fal-ai', model: { key: 'acme-faces', name: 'Acme Faces' }, count: 3 }]);
    expect(fromDefaults.initialDetail).toBe('mid');
    const suggested = await open({ suggested: [{ provider: 'codex', model: { key: 'acme-host-image', name: 'Acme Host Image' }, count: 6 }] });
    expect(suggested.preselected).toEqual([{ provider: 'codex', model: { key: 'acme-host-image', name: 'Acme Host Image' }, count: 6 }]);
    expect(suggested.initialTotal).toBe(6);
  });

  it('rejects notes for models the image lane does not list', async () => {
    const failure = await fixture.callError('casting.round.open', { project: 'movie', lookId: fixture.looks.young.id, brief: ['Brief'], notes: { 'acme-unknown': 'Nope' } });
    expect(failure.error.code).toBe('CODEX_CASTING_ROUND_INVALID');
  });

  it('records one generate answer, saves defaults only when asked and is consumed once', async () => {
    const round = await open();
    const routes = [
      { provider: 'fal-ai', model: { key: 'acme-portrait', name: 'Acme Portrait' }, count: 4 },
      { provider: 'codex', model: { key: 'acme-host-image', name: 'Acme Host Image' }, count: 2 },
    ];
    const answered = (await fixture.call<{ round: CastingRound }>('casting.round.respond', {
      panelId: round.panelId, choice: { kind: 'generate', routes, maxConcurrentGenerations: 3, detail: 'mid' }, saveAsCastingDefaults: false,
    })).round;
    expect(answered.answer).toEqual({ kind: 'generate', routes, maxConcurrentGenerations: 3, detail: 'mid', estimatedCost: { amount: 0.2, currency: 'USD' }, castingDefaultsSaved: false });
    expect((await fixture.service.showCastingSettings({ homeDir: fixture.homeDir, projectName: 'movie' })).casting.routes).toEqual([]);
    expect((await fixture.callError('casting.round.respond', { panelId: round.panelId, choice: { kind: 'canceled' }, saveAsCastingDefaults: false })).error.code).toBe('CODEX_CASTING_ROUND_INVALID');

    const consumed = await fixture.call<CastingRoundConsumeResult>('casting.round.consume', { panelId: round.panelId });
    expect(consumed).toEqual({ status: 'generate', panelId: round.panelId, lookId: fixture.looks.young.id, routes, maxConcurrentGenerations: 3, detail: 'mid', referenceAssetFileIds: [], estimatedCost: { amount: 0.2, currency: 'USD' } });
    expect(await fixture.call<CastingRoundConsumeResult>('casting.round.consume', { panelId: round.panelId })).toEqual({ status: 'alreadyConsumed', panelId: round.panelId });
  });

  it('writes the casting defaults and candidate detail through Core when the save box is ticked, keeping the sheet detail', async () => {
    await fixture.service.setCastingSettings({ homeDir: fixture.homeDir, projectName: 'movie', casting: { routes: [], candidateDetail: 'lowest', characterSheetDetail: 'mid' } });
    const round = await open();
    const routes = [{ provider: 'fal-ai', model: { key: 'acme-faces', name: 'Acme Faces' }, count: 5 }];
    const answered = (await fixture.call<{ round: CastingRound }>('casting.round.respond', {
      panelId: round.panelId, choice: { kind: 'generate', routes, maxConcurrentGenerations: 2, detail: 'highest' }, saveAsCastingDefaults: true,
    })).round;
    expect(answered.answer).toMatchObject({ estimatedCost: { amount: 0.25, currency: 'USD' }, castingDefaultsSaved: true });
    expect((await fixture.service.showCastingSettings({ homeDir: fixture.homeDir, projectName: 'movie' })).casting).toEqual({ routes, candidateDetail: 'highest', characterSheetDetail: 'mid' });
  });

  it('rejects providers that do not offer a model and a model listed twice', async () => {
    const round = await open();
    const failure = await fixture.callError('casting.round.respond', {
      panelId: round.panelId,
      choice: { kind: 'generate', maxConcurrentGenerations: 2, detail: 'lowest', routes: [
        { provider: 'replicate', model: { key: 'acme-faces', name: 'Acme Faces' }, count: 1 },
        { provider: 'fal-ai', model: { key: 'acme-portrait', name: 'Acme Portrait' }, count: 1 },
        { provider: 'replicate', model: { key: 'acme-portrait', name: 'Acme Portrait' }, count: 1 },
      ] },
      saveAsCastingDefaults: false,
    });
    expect(failure.error.code).toBe('CODEX_CASTING_ROUND_INVALID');
    expect(failure.issues).toHaveLength(2);
  });

  it('reports cancel once and refuses consume before an answer', async () => {
    const round = await open();
    expect((await fixture.callError('casting.round.consume', { panelId: round.panelId })).error.code).toBe('CODEX_CASTING_ROUND_INVALID');
    await fixture.call('casting.round.respond', { panelId: round.panelId, choice: { kind: 'canceled' }, saveAsCastingDefaults: true });
    expect(await fixture.call<CastingRoundConsumeResult>('casting.round.consume', { panelId: round.panelId })).toEqual({ status: 'canceled', panelId: round.panelId });
    expect((await fixture.service.showCastingSettings({ homeDir: fixture.homeDir, projectName: 'movie' })).casting.routes).toEqual([]);
  });

  it('serves identity references as panel media', async () => {
    const roundId = await fixture.createRound(fixture.looks.young.id);
    const candidate = await fixture.importCandidate(roundId, 'acme-portrait');
    const round = await open({ references: [candidate.id] });
    expect(round.references).toHaveLength(1);
    const media = await fixture.client.readResource({ uri: round.references[0]!.imageUri });
    expect(media.contents[0]).toMatchObject({ blob: expect.any(String) });
    const state = await fixture.client.readResource({ uri: `renku-casting-round://${round.panelId}` });
    expect(JSON.parse((state.contents[0] as { text: string }).text)).toMatchObject({ panelId: round.panelId, revision: 1, answer: null });
  });
});
