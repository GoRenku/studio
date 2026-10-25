import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createMediaEngine, createMemoryProviderMetadataCache, EngineError, type MediaProvider } from '@gorenku/studio-engines';
import { createProjectDataService, initRenkuConfig, syncDefaultModelList } from '@gorenku/studio-core/server';
import { runGenerationCommand } from './command.js';
import { createGenerationCostEstimator } from './cost-estimator.js';
import { estimateGenerationRequest } from './estimate.js';
import { recordGenerationPrice, showGenerationPrice } from './price.js';

// A fictional provider: the CLI only composes the Engines estimate into Core's envelope.
function fictionalEngine(capabilities: Partial<MediaProvider> = {}) {
  return createMediaEngine([{ id: 'atlas', validate: async () => undefined, execute: async () => { throw new Error('not used'); }, ...capabilities }]);
}

const metadataCache = createMemoryProviderMetadataCache();
const runtimeContext = async () => ({
  credential: 'test', metadataCache, fetch: globalThis.fetch, signal: new AbortController().signal, requestTimeoutMs: 1000, operationTimeoutMs: 1000,
});

async function requestFixture() {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-estimate-cli-'));
  const homeDir = path.join(storageRoot, 'test-home');
  const projectDataService = createProjectDataService();
  await initRenkuConfig(storageRoot, { homeDir });
  await projectDataService.createMovieProject({ homeDir, projectName: 'movie', title: 'Estimate fixture' });
  const documentPath = 'tmp/operations/media-generation/request.json';
  const bytes = JSON.stringify({ provider: 'atlas', model: 'atlas/clip', mediaKind: 'video', prompt: 'Rain', request: { prompt: 'Rain', duration: 4 } });
  await fs.mkdir(path.dirname(path.join(storageRoot, 'movie', documentPath)), { recursive: true });
  await fs.writeFile(path.join(storageRoot, 'movie', documentPath), bytes);
  return { storageRoot, homeDir, projectDataService, documentPath, requestSha256: createHash('sha256').update(bytes).digest('hex') };
}

describe('generation estimate', () => {
  it('returns Core\'s display envelope for the exact request bytes', async () => {
    const fixture = await requestFixture();
    const engine = fictionalEngine({ readPrice: async () => ({
      currency: 'USD', components: [{ unit: 'second', unitPriceUsd: 0.09, quantity: { kind: 'field', pointer: '/duration' } }],
      source: { kind: 'providerApi', url: 'https://example.test/pricing', observedAt: '2026-10-20T00:00:00.000Z' }, notes: [],
    }) });
    const estimate = await estimateGenerationRequest({ flags: { file: fixture.documentPath }, runtime: {
      projectDataService: fixture.projectDataService, homeDir: fixture.homeDir, projectName: 'movie', mediaEngine: engine, createProviderContext: runtimeContext,
    } } as never);
    expect(estimate).toEqual({
      state: 'computed', amountUsd: 0.36, basis: '4 seconds × $0.09', observedAt: '2026-10-20T00:00:00.000Z',
      sourceUrl: 'https://example.test/pricing', notes: [], requestSha256: fixture.requestSha256,
    });
  });

  it('returns plan usage for a host plan request without asking Engines', async () => {
    const fixture = await requestFixture();
    const documentPath = 'tmp/operations/media-generation/host.json';
    const bytes = JSON.stringify({ provider: 'codex', model: 'host-image', mediaKind: 'image', prompt: 'Rain', request: { prompt: 'Rain' } });
    await fs.writeFile(path.join(fixture.storageRoot, 'movie', documentPath), bytes);
    const createProviderContext = vi.fn(runtimeContext);
    const estimate = await estimateGenerationRequest({ flags: { file: documentPath }, runtime: {
      projectDataService: fixture.projectDataService, homeDir: fixture.homeDir, projectName: 'movie', mediaEngine: fictionalEngine(), createProviderContext,
    } } as never);
    expect(estimate).toMatchObject({ state: 'hostPlanUsage', amountUsd: null, requestSha256: createHash('sha256').update(bytes).digest('hex') });
    expect(createProviderContext).not.toHaveBeenCalled();
  });

  it('prices one output of a route at its defaults when no request is given', async () => {
    const engine = fictionalEngine({
      readPrice: async () => ({
        currency: 'USD', components: [{ unit: 'image', unitPriceUsd: 0.05, quantity: { kind: 'field', pointer: '/num_images', default: 1 } }],
        source: { kind: 'providerApi', observedAt: '2026-10-20T00:00:00.000Z' }, notes: [],
      }),
      readInputSchema: async () => ({ type: 'object', properties: { num_images: { type: 'integer', default: 4 } } }),
    });
    const estimate = await createGenerationCostEstimator({ mediaEngine: engine, createProviderContext: runtimeContext })
      .estimate({ provider: 'atlas', model: 'atlas/image', requestSha256: null });
    expect(estimate).toMatchObject({ state: 'computed', amountUsd: 0.05, requestSha256: null });
  });

  it('estimates one output of a route from --provider and --model without a Project', async () => {
    const engine = fictionalEngine({
      readPrice: async () => ({
        currency: 'USD', components: [{ unit: 'image', unitPriceUsd: 0.05, quantity: { kind: 'field', pointer: '/num_images', default: 1 } }],
        source: { kind: 'providerApi', observedAt: '2026-10-20T00:00:00.000Z' }, notes: [],
      }),
      readInputSchema: async () => ({ type: 'object', properties: { num_images: { type: 'integer', default: 4 } } }),
    });
    const estimate = await estimateGenerationRequest({ flags: { provider: 'atlas', model: 'atlas/image' }, runtime: {
      mediaEngine: engine, createProviderContext: runtimeContext,
    } } as never);
    expect(estimate).toMatchObject({ state: 'computed', amountUsd: 0.05, requestSha256: null });
  });

  it('prices a route at a detail level from the synced Default Model List', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-estimate-detail-'));
    const list = path.join(homeDir, 'default-models.json');
    const detail = { lowest: { resolution: '1K' }, mid: { resolution: '2K' }, highest: { resolution: '4K' } };
    await fs.writeFile(list, JSON.stringify({ formatVersion: 1, lanes: { image: [{ model: 'atlas-image', name: 'Atlas Image', providers: [{ provider: 'atlas', route: 'atlas/image', detail }], recommendedFor: [] }], imageEdit: [], video: [], audio: [] } }));
    await syncDefaultModelList({ homeDir, file: list });
    const engine = fictionalEngine({
      readPrice: async () => ({
        currency: 'USD', components: [{ unit: 'image', unitPriceUsd: 0.05, quantity: { kind: 'constant', value: 1 }, tiers: [{ when: { '/resolution': '1K' }, unitPriceUsd: 0.05 }, { when: { '/resolution': '4K' }, unitPriceUsd: 0.2 }] }],
        source: { kind: 'providerApi', observedAt: '2026-10-20T00:00:00.000Z' }, notes: [],
      }),
    });
    const estimate = (level: string) => estimateGenerationRequest({ flags: { provider: 'atlas', model: 'atlas/image', detail: level }, runtime: { homeDir, mediaEngine: engine, createProviderContext: runtimeContext } } as never);
    expect(await estimate('lowest')).toMatchObject({ amountUsd: 0.05 });
    expect(await estimate('highest')).toMatchObject({ amountUsd: 0.2 });
    await expect(estimate('4K')).rejects.toMatchObject({ code: 'CLI001' });
  });

  it.each([
    ['both inputs', { file: 'request.json', provider: 'atlas', model: 'atlas/image' }],
    ['a provider without a route', { provider: 'atlas' }],
  ])('rejects %s', async (_name, flags) => {
    await expect(estimateGenerationRequest({ flags, runtime: { mediaEngine: fictionalEngine(), createProviderContext: runtimeContext } } as never))
      .rejects.toMatchObject({ code: 'CLI001' });
  });

  it('reports a failed estimate as a missing price instead of failing', async () => {
    const fixture = await requestFixture();
    const estimate = await estimateGenerationRequest({ flags: { file: fixture.documentPath }, runtime: {
      projectDataService: fixture.projectDataService, homeDir: fixture.homeDir, projectName: 'movie', mediaEngine: fictionalEngine(),
      createProviderContext: async () => { throw new EngineError('ENGINE_AUTHENTICATION_FAILED', 'Atlas key missing.', { provider: 'atlas' }); },
    } } as never);
    expect(estimate).toMatchObject({ state: 'missingPrice', amountUsd: null, notes: ['Atlas key missing.'] });
  });
});

describe('generation price', () => {
  it('records an agent-researched price and shows it with its age', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-price-cli-'));
    const file = path.join(directory, 'price.json');
    const observedAt = new Date(Date.now() - 2 * 3_600_000).toISOString();
    await fs.writeFile(file, JSON.stringify({
      currency: 'USD',
      components: [{ unit: 'second', unitPriceUsd: 0.1, quantity: { kind: 'field', pointer: '/duration' } }],
      source: { kind: 'recorded', url: 'https://example.test/pricing', observedAt },
      notes: [],
    }));
    const runtime = { mediaEngine: fictionalEngine(), createProviderContext: runtimeContext };
    const recorded = await recordGenerationPrice({ flags: { provider: 'atlas', model: 'atlas/clip', file }, runtime } as never);
    expect(recorded).toMatchObject({ provider: 'atlas', model: 'atlas/clip', recorded: { ageHours: 2 } });
    expect(await showGenerationPrice({ flags: { provider: 'atlas', model: 'atlas/clip' }, runtime } as never)).toMatchObject({
      price: { price: { source: { kind: 'recorded', url: 'https://example.test/pricing' } }, ageHours: 2 },
    });
  });

  it('reports an invalid price entry as a structured error', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-price-cli-'));
    const file = path.join(directory, 'price.json');
    await fs.writeFile(file, JSON.stringify({ currency: 'EUR' }));
    await expect(recordGenerationPrice({ flags: { provider: 'atlas', model: 'atlas/other', file }, runtime: { mediaEngine: fictionalEngine(), createProviderContext: runtimeContext } } as never))
      .rejects.toMatchObject({ code: 'ENGINE_PRICE_INVALID' });
  });

  it('dispatches the price and estimate commands', async () => {
    const io = { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } };
    await expect(runGenerationCommand({ input: ['price', 'show'], flags: {}, json: true, io })).rejects.toMatchObject({ code: 'CLI001' });
    await expect(runGenerationCommand({ input: ['estimate'], flags: {}, json: true, io })).rejects.toMatchObject({ code: 'CLI001' });
  });
});
