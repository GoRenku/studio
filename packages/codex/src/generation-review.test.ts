import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProjectDataService, initRenkuConfig } from '@gorenku/studio-core/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { GenerationReviewDraft, GenerationReviewRoute } from './client.js';
import { openGenerationReview } from './generation-review.js';
import { consumeGenerationReview, respondToGenerationReview } from './generation-review-responses.js';
import { GenerationReviewState } from './generation-review-state.js';

const route = { provider: 'fal-ai', providerLabel: 'Fal.ai', model: 'model-a', label: 'Model A', mediaKind: 'image' as const };
const alternative = { ...route, model: 'model-b', label: 'Model B' };
const third = { ...route, model: 'model-c', label: 'Model C' };
const reviewFile = 'tmp/operations/media-generation/prepared.json';
const stagedFile = 'tmp/operations/media-generation/candidate.json';
const controls = { groups: [{ label: 'Image', fields: [{ key: '/seed', label: 'Seed', kind: 'integer' as const, initialValue: 1 }] }] };
const request = { reviewFile, routes: [route, alternative, third], controls };
const diagnostics = [{ code: 'PREPARATION_FAILED', message: 'The replacement could not be prepared.', severity: 'error' as const, location: { path: [] } }];
const originalBytes = `${JSON.stringify(document(route), null, 2)}\n`;
let root: string;
let homeDir: string;
let projectFolder: string;
let state: GenerationReviewState;
let reviewId: string;

function document(selected: GenerationReviewRoute) {
  return { provider: selected.provider, model: selected.model, mediaKind: selected.mediaKind, prompt: 'Café\nα', request: { prompt: 'Café\nα', seed: 1 } };
}

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-review-preparation-'));
  homeDir = path.join(root, 'home');
  const storage = path.join(root, 'movies');
  await initRenkuConfig(storage, { homeDir });
  await createProjectDataService().createMovieProject({ homeDir, projectName: 'movie', title: 'Review preparation' });
  projectFolder = path.join(storage, 'movie');
  await fs.mkdir(path.dirname(path.join(projectFolder, reviewFile)), { recursive: true });
});

beforeEach(async () => {
  await fs.writeFile(path.join(projectFolder, reviewFile), originalBytes);
  state = new GenerationReviewState();
  const review = await openGenerationReview(state, { project: 'movie', requests: [request] }, homeDir);
  reviewId = review.reviewId;
});

afterAll(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
});

async function select(selected: GenerationReviewRoute, drafts?: GenerationReviewDraft[]) {
  const review = state.read(reviewId);
  const responseId = `selection-${review.revision}`;
  const accepted = await respondToGenerationReview(state, {
    reviewId, expectedRevision: review.revision, responseId, action: 'reconfigure', drafts: drafts ?? review.drafts,
    selectedRoute: { requestId: review.requests[0]!.requestId, route: selected },
  }, homeDir);
  await consumeGenerationReview(state, { reviewId, responseId }, homeDir);
  return accepted.review.revision;
}

describe('staged model preparation', () => {
  it('preserves exact source bytes and edited drafts when a failed candidate is followed by returning to the prepared model', async () => {
    const drafts = state.read(reviewId).drafts;
    drafts[0]!.prompt = 'Étude\nUser edit';
    drafts[0]!.values['/seed'] = 42;
    const expectedRevision = await select(alternative, drafts);
    await fs.writeFile(path.join(projectFolder, stagedFile), '{ invalid JSON');
    await expect(openGenerationReview(state, {
      project: 'movie', reviewId, expectedRevision, requests: [{ ...request, reviewFile: stagedFile }],
    }, homeDir)).rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_REVIEW_INVALID' });

    const failed = await openGenerationReview(state, { project: 'movie', reviewId, expectedRevision, preparationFailure: diagnostics }, homeDir);
    expect(failed).toMatchObject({ phase: 'preparationFailed', drafts });
    expect(await fs.readFile(path.join(projectFolder, reviewFile), 'utf8')).toBe(originalBytes);
    expect(state.binding(reviewId).sources[0]!.reviewFile).toBe(reviewFile);
    await expect(respondToGenerationReview(state, {
      reviewId, expectedRevision: failed.revision, responseId: 'premature-submit', action: 'submit', drafts,
    }, homeDir)).rejects.toMatchObject({ code: 'CODEX_REVIEW_INVALID' });

    const returnRevision = await select(route);
    const restored = await openGenerationReview(state, { project: 'movie', reviewId, expectedRevision: returnRevision, requests: [request] }, homeDir);
    expect(restored).toMatchObject({ phase: 'ready', drafts });
    await respondToGenerationReview(state, { reviewId, expectedRevision: restored.revision, responseId: 'submit', action: 'submit', drafts }, homeDir);
    const consumed = await consumeGenerationReview(state, { reviewId, responseId: 'submit' }, homeDir);
    expect(consumed).toMatchObject({ alreadyConsumed: false, action: { drafts, requests: [{ reviewFile }] } });
  });

  it.each([alternative, third])('adopts a validated staged file for $label after preparation failure', async (selected) => {
    const expectedRevision = await select(alternative);
    await openGenerationReview(state, { project: 'movie', reviewId, expectedRevision, preparationFailure: diagnostics }, homeDir);
    const retryRevision = await select(selected);
    const bytes = JSON.stringify(document(selected));
    await fs.writeFile(path.join(projectFolder, stagedFile), bytes);
    const expectedRequestSha256 = createHash('sha256').update(bytes).digest('hex');
    const prepared = await openGenerationReview(state, {
      project: 'movie', reviewId, expectedRevision: retryRevision,
      requests: [{ ...request, reviewFile: stagedFile, expectedRequestSha256 }],
    }, homeDir);
    expect(prepared).toMatchObject({ phase: 'ready', requests: [{ preview: { model: selected.model }, requestSha256: expectedRequestSha256 }] });
    expect(await fs.readFile(path.join(projectFolder, reviewFile), 'utf8')).toBe(originalBytes);
    await respondToGenerationReview(state, { reviewId, expectedRevision: prepared.revision, responseId: 'submit', action: 'submit', drafts: prepared.drafts }, homeDir);
    const consumed = await consumeGenerationReview(state, { reviewId, responseId: 'submit' }, homeDir);
    expect(consumed).toMatchObject({ alreadyConsumed: false, action: { requests: [{ reviewFile: stagedFile, requestSha256: expectedRequestSha256 }] } });
  });

  it('rejects a staged request for a route other than the selected model without changing the binding', async () => {
    const expectedRevision = await select(alternative);
    await fs.writeFile(path.join(projectFolder, stagedFile), JSON.stringify(document(third)));
    await expect(openGenerationReview(state, {
      project: 'movie', reviewId, expectedRevision, requests: [{ ...request, reviewFile: stagedFile }],
    }, homeDir)).rejects.toMatchObject({ code: 'CODEX_REVIEW_INVALID' });
    expect(state.binding(reviewId).sources[0]!.reviewFile).toBe(reviewFile);
    expect(state.read(reviewId).phase).toBe('preparing');
  });

  it('rejects candidate bytes that changed after validation without replacing the prepared request', async () => {
    const expectedRevision = await select(alternative);
    await fs.writeFile(path.join(projectFolder, stagedFile), JSON.stringify(document(alternative)));
    await expect(openGenerationReview(state, {
      project: 'movie', reviewId, expectedRevision,
      requests: [{ ...request, reviewFile: stagedFile, expectedRequestSha256: 'a'.repeat(64) }],
    }, homeDir)).rejects.toMatchObject({ code: 'CODEX_REVIEW_STALE' });
    expect(state.binding(reviewId).sources[0]!.reviewFile).toBe(reviewFile);
  });

  it('keeps stale-source protection when the prepared file is externally changed', async () => {
    const expectedRevision = await select(alternative);
    await fs.writeFile(path.join(projectFolder, reviewFile), '{ externally changed');
    await fs.writeFile(path.join(projectFolder, stagedFile), JSON.stringify(document(alternative)));
    await expect(openGenerationReview(state, {
      project: 'movie', reviewId, expectedRevision, requests: [{ ...request, reviewFile: stagedFile }],
    }, homeDir)).rejects.toMatchObject({ code: 'CODEX_REVIEW_STALE' });
    await expect(openGenerationReview(state, {
      project: 'movie', reviewId, expectedRevision, preparationFailure: diagnostics,
    }, homeDir)).rejects.toMatchObject({ code: 'CODEX_REVIEW_STALE' });
    expect(state.read(reviewId).phase).toBe('preparing');
  });
});
