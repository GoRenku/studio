import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createMediaEngine, createMemoryProviderMetadataCache, EngineError, type MediaProvider } from '@gorenku/studio-engines';
import { createProjectDataService, initRenkuConfig } from '@gorenku/studio-core/server';
import { runGenerationCommand } from './command.js';
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
    const engine = fictionalEngine({ quoteCost: async () => ({ amountUsd: 0.36, sourceUrl: 'https://example.test/quote' }) });
    const estimate = await estimateGenerationRequest({ flags: { file: fixture.documentPath }, runtime: {
      projectDataService: fixture.projectDataService, homeDir: fixture.homeDir, projectName: 'movie', mediaEngine: engine, createProviderContext: runtimeContext,
    } } as never);
    expect(estimate).toEqual({
      state: 'quoted', amountUsd: 0.36, basis: 'Provider quote for this request', observedAt: expect.any(String),
      sourceUrl: 'https://example.test/quote', notes: [], requestSha256: fixture.requestSha256,
    });
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
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      notes: [],
    }));
    const runtime = { mediaEngine: fictionalEngine(), createProviderContext: runtimeContext };
    const recorded = await recordGenerationPrice({ flags: { provider: 'atlas', model: 'atlas/clip', file }, runtime } as never);
    expect(recorded).toMatchObject({ provider: 'atlas', model: 'atlas/clip', recorded: { expired: false, ageHours: 2 } });
    expect(await showGenerationPrice({ flags: { provider: 'atlas', model: 'atlas/clip' }, runtime } as never)).toMatchObject({
      recorded: { price: { source: { kind: 'recorded', url: 'https://example.test/pricing' } } },
      providerApi: null,
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
