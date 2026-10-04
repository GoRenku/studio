import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { createProjectDataService, initRenkuConfig } from '@gorenku/studio-core/server';
import type { GenerationReview, GenerationReviewReceipt } from './client.js';
import { createCodexServer } from './server.js';

let root: string;
let configPath: string;
let client: Client;
let server: ReturnType<typeof createCodexServer>;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-codex-protocol-'));
  const homeDir = path.join(root, 'home');
  const storage = path.join(root, 'movies');
  configPath = (await initRenkuConfig(storage, { homeDir })).configPath;
  await createProjectDataService().createMovieProject({ homeDir, projectName: 'movie', title: 'MCP protocol fixture' });
  const reviewFile = path.join(storage, 'movie', 'tmp/operations/media-generation/request.json');
  await fs.mkdir(path.dirname(reviewFile), { recursive: true });
  await fs.writeFile(reviewFile, JSON.stringify({ provider: 'fal-ai', model: 'image-model', mediaKind: 'image', prompt: 'Café\nα', request: { prompt: 'Café\nα', resolution: '2K' } }));
  const html = path.join(root, 'app.html');
  await fs.writeFile(html, '<!doctype html><html><body>Protocol resource fixture</body></html>');
  server = createCodexServer({ version: '0.1.24', generationReviewHtml: html, homeDir });
  client = new Client({ name: 'codex-mcp-client', version: '1.0.0', title: 'Codex' }, {
    capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] } } },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client?.close();
  await server?.close();
  if (root) await fs.rm(root, { recursive: true, force: true });
});

const opening = {
  project: 'movie',
  requests: [{
    reviewFile: 'tmp/operations/media-generation/request.json',
    routes: [{ provider: 'fal-ai', providerLabel: 'Fal.ai', model: 'image-model', label: 'Image model', mediaKind: 'image' }],
    controls: { groups: [{ label: 'Image settings', fields: [{ key: '/resolution', label: 'Resolution', kind: 'enum', required: true, initialValue: '2K', options: [{ label: '2K', value: '2K' }, { label: '4K', value: '4K' }] }] }] },
  }],
};

describe('official MCP registration and transport', () => {
  it('discovers the capability probe, review tools and an inline-preferred review resource supporting both modes', async () => {
    const tools = (await client.listTools()).tools;
    expect(tools.map((tool) => tool.name).sort()).toEqual(['generation.review', 'generation.review.capabilities', 'generation.review.consume', 'generation.review.respond']);
    expect(tools.find((tool) => tool.name === 'generation.review.respond')?._meta?.ui).toMatchObject({ visibility: ['app'] });
    expect(tools.every((tool) => !(tool._meta?.['openai/ui'] as { entrypoints?: unknown[] } | undefined)?.entrypoints?.length)).toBe(true);
    const resource = await client.readResource({ uri: 'ui://renku/generation-review' });
    expect(resource.contents[0]).toMatchObject({ mimeType: 'text/html;profile=mcp-app', _meta: { 'openai/ui': { preferredDisplayMode: 'inline', availableDisplayModes: ['inline', 'fullscreen'] }, ui: { csp: { connectDomains: ['blob:'], resourceDomains: ['blob:'] } } } });
    expect((await client.listResources()).resources.map((resource) => resource.uri)).toEqual(['ui://renku/generation-review']);
  });

  it.each(['inline', 'fullscreen'])('reads the current %s preference without restarting the MCP connection', async (mode) => {
    const contents = await fs.readFile(configPath, 'utf8');
    try {
      await fs.writeFile(configPath, contents.replace('codexGenerationReviewDisplayMode: inline', `codexGenerationReviewDisplayMode: ${mode}`));
      const resource = await client.readResource({ uri: 'ui://renku/generation-review' });
      expect(resource.contents[0]?._meta?.['openai/ui']).toEqual({ preferredDisplayMode: mode, availableDisplayModes: ['inline', 'fullscreen'] });
    } finally {
      await fs.writeFile(configPath, contents);
    }
  });

  it('reports invalid display configuration instead of substituting a mode', async () => {
    const contents = await fs.readFile(configPath, 'utf8');
    try {
      await fs.writeFile(configPath, contents.replace('codexGenerationReviewDisplayMode: inline', 'codexGenerationReviewDisplayMode: pip'));
      await expect(client.readResource({ uri: 'ui://renku/generation-review' })).rejects.toMatchObject({ data: { error: { code: 'CONFIG016' } } });
    } finally {
      await fs.writeFile(configPath, contents);
    }
  });

  it('reports advertisement without claiming the panel has rendered', async () => {
    const result = await client.callTool({ name: 'generation.review.capabilities', arguments: {} });
    expect(result.structuredContent).toEqual({
      client: { name: 'codex-mcp-client', version: '1.0.0', title: 'Codex' },
      panel: { status: 'advertised', reason: 'codex-ui-advertised' },
    });
  });

  it('opens immediately, stores exact edits and consumes the accepted action once through the SDK', async () => {
    const opened = await client.callTool({ name: 'generation.review', arguments: opening });
    expect(opened.isError).not.toBe(true);
    const review = (opened.structuredContent as { review: GenerationReview }).review;
    expect(review).toMatchObject({ phase: 'ready', revision: 1, requests: [{ preview: { prompt: 'Café\nα' } }] });
    expect(JSON.stringify(review)).not.toContain('request.json');
    const drafts = [{ ...review.drafts[0]!, prompt: 'Étude\nα', values: { '/resolution': '4K' } }];
    const response = await client.callTool({ name: 'generation.review.respond', arguments: { reviewId: review.reviewId, expectedRevision: review.revision, responseId: 'accepted', action: 'submit', drafts } });
    expect(response.isError).not.toBe(true);
    const receipt = (response.structuredContent as { action: GenerationReviewReceipt }).action;
    expect(Object.keys(receipt).sort()).toEqual(['action', 'responseId', 'reviewId', 'revision']);
    const consumed = await client.callTool({ name: 'generation.review.consume', arguments: { reviewId: review.reviewId, responseId: receipt.responseId } });
    expect(consumed.structuredContent).toMatchObject({ alreadyConsumed: false, action: { drafts, requests: [{ reviewFile: opening.requests[0]!.reviewFile }] } });
    expect((await client.callTool({ name: 'generation.review.consume', arguments: { reviewId: review.reviewId, responseId: receipt.responseId } })).structuredContent).toEqual({ alreadyConsumed: true });
    const refreshed = await client.readResource({ uri: `renku-review://${review.reviewId}` });
    expect(JSON.parse((refreshed.contents[0] as { text: string }).text)).toMatchObject({ phase: 'submitted' });
  });

  it('serves filesystem-owned Inspiration images and thumbnails through scoped review resources', async () => {
    const homeDir = path.join(root, 'home');
    const service = createProjectDataService();
    const { folder } = await service.createInspirationFolder({ homeDir, projectName: 'movie', name: 'Coco' });
    const pixels = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#808080' } }).png().toBuffer();
    const image = await service.writeInspirationImage({ homeDir, projectName: 'movie', folderId: folder.id, fileName: 'frame.png', contents: pixels });
    const reviewFile = 'tmp/operations/media-generation/inspiration.json';
    await fs.writeFile(path.join(root, 'movies/movie', reviewFile), JSON.stringify({
      provider: 'fal-ai', model: 'image-model', mediaKind: 'image', prompt: 'Reference appearance',
      request: { image: { $file: `${folder.projectRelativePath}/frame.png`, reviewLabel: 'Coco appearance' }, resolution: '2K' },
    }));
    const opened = await client.callTool({ name: 'generation.review', arguments: {
      ...opening, requests: [{ ...opening.requests[0]!, reviewFile }],
    } });
    expect(opened.isError).not.toBe(true);
    const review = (opened.structuredContent as { review: GenerationReview }).review;
    const reference = review.requests[0]!.preview.references[0]!;
    expect(reference).toMatchObject({ kind: 'image', available: true, reviewLabel: 'Coco appearance' });
    expect(review.requests[0]!.preview.diagnostics).toEqual([]);
    const original = (await client.readResource({ uri: reference.resourceUri })).contents[0] as { mimeType: string; blob: string };
    expect(original.mimeType).toBe('image/png');
    expect(Buffer.from(original.blob, 'base64')).toEqual(pixels);
    const thumbnail = (await client.readResource({ uri: reference.thumbnailUri! })).contents[0] as { mimeType: string; blob: string };
    expect(thumbnail.mimeType).toBe('image/webp');
    expect(Buffer.from(thumbnail.blob, 'base64').length).toBeGreaterThan(0);
    await service.deleteInspirationImage({ homeDir, projectName: 'movie', folderId: folder.id, assetFileId: image.resource.images[0]!.id });
    await expect(client.readResource({ uri: reference.resourceUri }))
      .rejects.toMatchObject({ data: { error: { code: 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND' } } });
  });

  it('serializes tool and scoped-resource failures as structured diagnostics', async () => {
    const expired = await client.callTool({ name: 'generation.review.consume', arguments: { reviewId: 'not-registered', responseId: 'not-accepted' } });
    expect(expired).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_REVIEW_EXPIRED' } } });
    await expect(client.readResource({ uri: 'renku-review://not-registered' })).rejects.toMatchObject({ data: { error: { code: 'CODEX_REVIEW_EXPIRED' } } });
  });
});

describe('host capability negotiation', () => {
  it.each([
    ['codex-mcp-client', {}, 'mcp-app-ui-unavailable'],
    ['codex-mcp-client', { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html'] } } }, 'mcp-app-ui-unavailable'],
    ['claude-code', {}, 'non-codex-client'],
    ['claude-desktop', { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] } } }, 'non-codex-client'],
    ['unknown-agent', {}, 'non-codex-client'],
  ])('requires Studio Preview for %s with capabilities %j', async (name, capabilities, reason) => {
    const isolatedServer = createCodexServer({ version: '0.1.24', generationReviewHtml: path.join(root, 'app.html') });
    const isolatedClient = new Client({ name, version: 'test' }, { capabilities });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await isolatedServer.connect(serverTransport);
      await isolatedClient.connect(clientTransport);
      const probe = await isolatedClient.callTool({ name: 'generation.review.capabilities', arguments: {} });
      expect(probe.structuredContent).toMatchObject({ client: { name }, panel: { status: 'unavailable', reason } });
      // Rejection happens before resolving the nonexistent Project or reading any request.
      const result = await isolatedClient.callTool({ name: 'generation.review', arguments: { ...opening, project: 'missing' } });
      expect(result).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_REVIEW_UNSUPPORTED' } } });
    } finally {
      await isolatedClient.close();
      await isolatedServer.close();
    }
  });
});
