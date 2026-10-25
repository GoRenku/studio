import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { createProjectDataService, initRenkuConfig, syncDefaultModelList } from '@gorenku/studio-core/server';
import { createFakeCostEstimator } from '../testing/fake-cost-estimator.js';
import { createCodexServer } from '../server.js';
import type { RouteChooser, RouteConsumeResult } from './contracts.js';

const service = createProjectDataService();
// Fictional model families: the runtime lists whatever the Skill's Default Model List names.
const defaultModels = {
  formatVersion: 1,
  lanes: {
    image: [],
    imageEdit: [
      { model: 'acme-retouch', name: 'Acme Retouch', providers: [{ provider: 'fal-ai', route: 'route/acme-retouch', detail: { lowest: {}, mid: {}, highest: {} } }, { provider: 'replicate', route: 'route/acme-retouch', detail: { lowest: {}, mid: {}, highest: {} } }], recommendedFor: ['fal-ai'] },
      { model: 'acme-restyle', name: 'Acme Restyle', providers: [{ provider: 'fal-ai', route: 'route/acme-restyle', detail: { lowest: {}, mid: {}, highest: {} } }], recommendedFor: [] },
      { model: 'acme-host-edit', name: 'Acme Host Edit', providers: [{ provider: 'codex', route: 'route/acme-host-edit', detail: { lowest: {}, mid: {}, highest: {} } }], recommendedFor: ['codex'] },
    ],
    video: [],
    audio: [],
  },
};

let root: string;
let homeDir: string;
let client: Client;
let server: ReturnType<typeof createCodexServer>;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-route-choice-'));
  homeDir = path.join(root, 'home');
  await initRenkuConfig(path.join(root, 'movies'), { homeDir });
  await fs.writeFile(path.join(homeDir, '.config', 'renku', '.env'), 'FAL_KEY=test-key\n');
  await service.createMovieProject({ homeDir, projectName: 'movie', title: 'Route choice fixture' });
  const html = path.join(root, 'app.html');
  await fs.writeFile(html, '<!doctype html><html><body>Panel</body></html>');
  server = createCodexServer({ version: 'test', generationReviewHtml: html, dialogueDirectionHtml: html, imageEditHtml: html, imageEditTargetChooserHtml: html, routeChooserHtml: html, castingRoundHtml: html, castingBoardHtml: html, castingWardrobeHtml: html, costEstimator: createFakeCostEstimator(), homeDir });
  client = new Client({ name: 'codex-mcp-client', version: '1.0.0' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] } } } as never });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client?.close();
  await server?.close();
  if (root) await fs.rm(root, { recursive: true, force: true });
});

async function writeDefaultModels(value: unknown): Promise<void> {
  const file = path.join(root, 'default-models.json');
  await fs.writeFile(file, JSON.stringify(value));
  await syncDefaultModelList({ homeDir, file });
}

async function call<T>(name: string, input: Record<string, unknown>): Promise<T> {
  const result = await client.callTool({ name, arguments: input });
  if (result.isError) throw Object.assign(new Error(JSON.stringify(result.structuredContent)), { structuredContent: result.structuredContent });
  return result.structuredContent as T;
}

async function callError(name: string, input: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: input });
  expect(result.isError).toBe(true);
  return result.structuredContent as { error: { code: string; message: string } };
}

async function choose(input: Record<string, unknown> = {}): Promise<RouteChooser> {
  return (await call<{ chooser: RouteChooser }>('generation.route.choose', { project: 'movie', purpose: 'image.edit', lane: 'imageEdit', ...input })).chooser;
}

async function laneSettings() {
  return (await service.readProjectSettings({ homeDir, projectName: 'movie' })).settings.generation.imageEdit;
}

describe('Route Chooser', () => {
  beforeEach(async () => {
    await service.updateGenerationLaneSettings({ homeDir, projectName: 'movie', lane: 'imageEdit', provider: 'fal-ai', model: null, chooseRouteBeforeGenerating: true });
  });

  it('fails clearly before the Default Model List is synced', async () => {
    expect((await callError('generation.route.choose', { project: 'movie', purpose: 'image.edit', lane: 'imageEdit' })).error.code).toBe('CODEX_ROUTE_CHOICE_NOT_SYNCED');
  });

  it('exposes respond only to the app and the other tools to the model', async () => {
    await writeDefaultModels(defaultModels);
    const tools = (await client.listTools()).tools.filter((tool) => tool.name.startsWith('generation.route'));
    const visibility = Object.fromEntries(tools.map((tool) => [tool.name, (tool._meta as { ui?: { visibility?: string[] } } | undefined)?.ui?.visibility]));
    expect(visibility).toEqual({
      'generation.route.choose': ['model'],
      'generation.route.respond': ['app'],
      'generation.route.consume': ['model'],
    });
  });

  it('lists providers with key status and preselects the lane recommendation', async () => {
    const chooser = await choose();
    expect(chooser).toMatchObject({
      lane: 'imageEdit',
      laneLabel: 'Image Editing',
      purpose: 'image.edit',
      chooseRouteBeforeGenerating: true,
      answer: null,
      preselected: { provider: 'fal-ai', model: 'acme-retouch' },
      providers: [
        { provider: 'fal-ai', label: 'Fal.ai', available: true, models: [
          { key: 'acme-retouch', name: 'Acme Retouch', recommended: true },
          { key: 'acme-restyle', name: 'Acme Restyle', recommended: false },
        ] },
        { provider: 'replicate', label: 'Replicate', available: false, models: [{ key: 'acme-retouch', name: 'Acme Retouch', recommended: false }] },
        { provider: 'codex', label: 'Codex (built-in)', available: true, models: [{ key: 'acme-host-edit', name: 'Acme Host Edit', recommended: true }] },
      ],
    });
  });

  it('preselects the saved lane model or an offered suggestion', async () => {
    await service.updateGenerationLaneSettings({ homeDir, projectName: 'movie', lane: 'imageEdit', model: { key: 'acme-restyle', name: 'Acme Restyle' } });
    expect((await choose()).preselected).toEqual({ provider: 'fal-ai', model: 'acme-restyle' });
    expect((await choose({ suggested: { provider: 'codex', model: 'acme-host-edit' } })).preselected).toEqual({ provider: 'codex', model: 'acme-host-edit' });
    expect((await choose({ suggested: { provider: 'replicate', model: 'acme-retouch' } })).preselected).toEqual({ provider: 'fal-ai', model: 'acme-restyle' });
  });

  it('rejects a purpose outside the named lane', async () => {
    expect((await callError('generation.route.choose', { project: 'movie', purpose: 'cast.profile', lane: 'imageEdit' })).error.code).toBe('CODEX_ROUTE_CHOICE_INVALID');
  });

  it('records one choice, consumes it once, and leaves settings unchanged without the toggles', async () => {
    const chooser = await choose();
    expect((await callError('generation.route.consume', { choiceId: chooser.choiceId })).error.code).toBe('CODEX_ROUTE_CHOICE_INVALID');
    expect((await callError('generation.route.respond', { choiceId: chooser.choiceId, choice: { kind: 'chosen', provider: 'replicate', model: 'acme-retouch' }, saveAsLaneDefault: false, chooseRouteBeforeGenerating: true })).error.code).toBe('CODEX_ROUTE_CHOICE_INVALID');
    const answered = (await call<{ chooser: RouteChooser }>('generation.route.respond', { choiceId: chooser.choiceId, choice: { kind: 'chosen', provider: 'codex', model: 'acme-host-edit' }, saveAsLaneDefault: false, chooseRouteBeforeGenerating: true })).chooser;
    expect(answered.answer).toEqual({ kind: 'chosen', provider: 'codex', model: 'acme-host-edit' });
    expect((await callError('generation.route.respond', { choiceId: chooser.choiceId, choice: { kind: 'canceled' }, saveAsLaneDefault: false, chooseRouteBeforeGenerating: true })).error.code).toBe('CODEX_ROUTE_CHOICE_INVALID');
    expect(await call<RouteConsumeResult>('generation.route.consume', { choiceId: chooser.choiceId })).toEqual({
      status: 'chosen',
      choiceId: chooser.choiceId,
      chosen: { provider: 'codex', providerLabel: 'Codex (built-in)', model: { key: 'acme-host-edit', name: 'Acme Host Edit' } },
      laneSettingsChanged: false,
    });
    expect(await call<RouteConsumeResult>('generation.route.consume', { choiceId: chooser.choiceId })).toEqual({ status: 'alreadyConsumed', choiceId: chooser.choiceId });
    expect(await laneSettings()).toMatchObject({ provider: 'fal-ai', model: null, chooseRouteBeforeGenerating: true });
  });

  it('saves the lane default and stops asking only on a chosen answer', async () => {
    const chooser = await choose();
    await call('generation.route.respond', { choiceId: chooser.choiceId, choice: { kind: 'chosen', provider: 'codex', model: 'acme-host-edit' }, saveAsLaneDefault: true, chooseRouteBeforeGenerating: false });
    expect(await laneSettings()).toMatchObject({ provider: 'codex', model: { key: 'acme-host-edit', name: 'Acme Host Edit' }, chooseRouteBeforeGenerating: false });
    expect(await call<RouteConsumeResult>('generation.route.consume', { choiceId: chooser.choiceId })).toMatchObject({ status: 'chosen', laneSettingsChanged: true });
  });

  it('changes nothing when canceled, even with the toggles set', async () => {
    const chooser = await choose();
    await call('generation.route.respond', { choiceId: chooser.choiceId, choice: { kind: 'canceled' }, saveAsLaneDefault: true, chooseRouteBeforeGenerating: false });
    expect(await call<RouteConsumeResult>('generation.route.consume', { choiceId: chooser.choiceId })).toEqual({ status: 'canceled', choiceId: chooser.choiceId });
    expect(await laneSettings()).toMatchObject({ provider: 'fal-ai', model: null, chooseRouteBeforeGenerating: true });
  });

  it('fails clearly when the Default Model List names a provider this runtime does not know', async () => {
    await writeDefaultModels({ ...defaultModels, lanes: { ...defaultModels.lanes, imageEdit: [
      { model: 'acme-retouch', name: 'Acme Retouch', providers: [{ provider: 'acme-unknown', route: 'route/acme-retouch', detail: { lowest: {}, mid: {}, highest: {} } }], recommendedFor: [] },
    ] } });
    expect((await callError('generation.route.choose', { project: 'movie', purpose: 'image.edit', lane: 'imageEdit' })).error.code).toBe('CODEX_ROUTE_CHOICE_INVALID');
    await writeDefaultModels(defaultModels);
  });
});
