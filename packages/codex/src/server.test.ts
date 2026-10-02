import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createProjectDataService, initRenkuConfig } from '@gorenku/studio-core/server';
import type { GenerationReview, GenerationReviewReceipt } from './client.js';
import { createCodexServer } from './server.js';

let root: string;
let client: Client;
let server: ReturnType<typeof createCodexServer>;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-codex-protocol-'));
  const homeDir = path.join(root, 'home');
  const storage = path.join(root, 'movies');
  await initRenkuConfig(storage, { homeDir });
  await createProjectDataService().createMovieProject({ homeDir, projectName: 'movie', title: 'MCP protocol fixture' });
  const reviewFile = path.join(storage, 'movie', 'tmp/operations/media-generation/request.json');
  await fs.mkdir(path.dirname(reviewFile), { recursive: true });
  await fs.writeFile(reviewFile, JSON.stringify({ provider: 'fal-ai', model: 'image-model', mediaKind: 'image', prompt: 'Café\nα', request: { prompt: 'Café\nα', resolution: '2K' } }));
  const html = path.join(root, 'app.html');
  await fs.writeFile(html, '<!doctype html><html><body>Protocol resource fixture</body></html>');
  server = createCodexServer({ version: '0.1.24', generationReviewHtml: html, homeDir });
  client = new Client({ name: 'review-protocol-test', version: '1.0.0' });
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
  it('discovers three review tools and a fullscreen-only review resource', async () => {
    const tools = (await client.listTools()).tools;
    expect(tools.map((tool) => tool.name).sort()).toEqual(['generation.review', 'generation.review.consume', 'generation.review.respond']);
    expect(tools.find((tool) => tool.name === 'generation.review.respond')?._meta?.ui).toMatchObject({ visibility: ['app'] });
    expect(tools.every((tool) => !(tool._meta?.['openai/ui'] as { entrypoints?: unknown[] } | undefined)?.entrypoints?.length)).toBe(true);
    const resource = await client.readResource({ uri: 'ui://renku/generation-review' });
    expect(resource.contents[0]).toMatchObject({ mimeType: 'text/html;profile=mcp-app', _meta: { 'openai/ui': { preferredDisplayMode: 'fullscreen', availableDisplayModes: ['fullscreen'] }, ui: { csp: { connectDomains: ['blob:'], resourceDomains: ['blob:'] } } } });
    expect((await client.listResources()).resources.map((resource) => resource.uri)).toEqual(['ui://renku/generation-review']);
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

  it('serializes tool and scoped-resource failures as structured diagnostics', async () => {
    const expired = await client.callTool({ name: 'generation.review.consume', arguments: { reviewId: 'not-registered', responseId: 'not-accepted' } });
    expect(expired).toMatchObject({ isError: true, structuredContent: { error: { code: 'CODEX_REVIEW_EXPIRED' } } });
    await expect(client.readResource({ uri: 'renku-review://not-registered' })).rejects.toMatchObject({ data: { error: { code: 'CODEX_REVIEW_EXPIRED' } } });
  });
});
