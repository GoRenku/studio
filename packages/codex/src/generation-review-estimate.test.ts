import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProjectDataService, initRenkuConfig } from '@gorenku/studio-core/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openGenerationReview } from './generation-review.js';
import { estimateReviewDraft } from './generation-review-estimate.js';
import { respondToGenerationReview } from './generation-review-responses.js';
import { GenerationReviewState } from './generation-review-state.js';
import { createFakeCostEstimator } from './testing/fake-cost-estimator.js';

// Fictional routes: estimates depend only on the injected estimator.
const charged = { provider: 'acme-video', providerLabel: 'Acme Video', model: 'acme/clip', label: 'Acme Clip', mediaKind: 'video' as const };
const hosted = { provider: 'acme-host', providerLabel: 'Acme Host', model: 'acme/host-image', label: 'Acme Host Image', mediaKind: 'image' as const };
const controls = { groups: [{ label: 'Video', fields: [{ key: '/duration', label: 'Duration', kind: 'integer' as const, initialValue: 5 }] }] };
const service = createProjectDataService();
let root: string;
let homeDir: string;
let projectFolder: string;

beforeAll(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-review-estimate-'));
  homeDir = path.join(root, 'home');
  const storage = path.join(root, 'movies');
  await initRenkuConfig(storage, { homeDir });
  await service.createMovieProject({ homeDir, projectName: 'movie', title: 'Review estimate' });
  projectFolder = path.join(storage, 'movie');
  await fs.mkdir(path.join(projectFolder, 'tmp/operations/media-generation'), { recursive: true });
  await fs.writeFile(path.join(projectFolder, 'tmp/operations/media-generation/video.json'), JSON.stringify({ provider: charged.provider, model: charged.model, mediaKind: 'video', prompt: 'Rain', request: { prompt: 'Rain', duration: 5 } }));
  await fs.writeFile(path.join(projectFolder, 'tmp/operations/media-generation/image.json'), JSON.stringify({ provider: hosted.provider, model: hosted.model, mediaKind: 'image', prompt: 'Rain', request: { prompt: 'Rain' } }));
});

afterAll(async () => {
  if (root) await fs.rm(root, { recursive: true, force: true });
});

beforeEach(async () => {
  await service.updateGenerationLaneSettings({ homeDir, projectName: 'movie', lane: 'video', askBeforeGenerating: true });
});

async function open(estimator = createFakeCostEstimator()) {
  const state = new GenerationReviewState();
  const review = await openGenerationReview(state, {
    project: 'movie', lane: 'video',
    requests: [{ reviewFile: 'tmp/operations/media-generation/video.json', routes: [charged], controls }],
  }, estimator, homeDir);
  return { state, review, estimator };
}

describe('generation review estimates', () => {
  it('attaches a server-computed estimate for the prepared request', async () => {
    const { review, estimator } = await open();
    expect(review.lane).toBe('video');
    expect(review.requests[0]!.preview.estimate).toMatchObject({ state: 'computed', amountUsd: 0.42, requestSha256: review.requests[0]!.requestSha256 });
    expect(estimator.calls).toEqual([expect.objectContaining({ provider: charged.provider, model: charged.model, request: { prompt: 'Rain', duration: 5 } })]);
  });

  it('leaves the billing decision to the estimator for every route', async () => {
    const estimator = createFakeCostEstimator();
    await openGenerationReview(new GenerationReviewState(), {
      project: 'movie', lane: 'image',
      requests: [{ reviewFile: 'tmp/operations/media-generation/image.json', routes: [hosted], controls: { groups: [] } }],
    }, estimator, homeDir);
    expect(estimator.calls).toEqual([expect.objectContaining({ provider: hosted.provider, model: hosted.model })]);
  });

  it('re-estimates edited control values without changing the request file', async () => {
    const { state, review, estimator } = await open();
    const estimate = await estimateReviewDraft(state, { reviewId: review.reviewId, requestId: review.requests[0]!.requestId, values: { '/duration': 10 } }, estimator, homeDir);
    expect(estimate.state).toBe('computed');
    expect(estimator.calls.at(-1)!.request).toEqual({ prompt: 'Rain', duration: 10 });
    await expect(estimateReviewDraft(state, { reviewId: review.reviewId, requestId: review.requests[0]!.requestId, values: { '/undeclared': 1 } }, estimator, homeDir))
      .rejects.toMatchObject({ code: 'CODEX_REVIEW_INVALID' });
  });

  it('a new review requires the lane', async () => {
    await expect(openGenerationReview(new GenerationReviewState(), {
      project: 'movie',
      requests: [{ reviewFile: 'tmp/operations/media-generation/video.json', routes: [charged], controls }],
    }, createFakeCostEstimator(), homeDir)).rejects.toMatchObject({ code: 'CODEX_REVIEW_INVALID' });
  });

  it('omits a cleared optional control while preserving unrepresented native fields and source bytes', async () => {
    const { state, review, estimator } = await open();
    const file = path.join(projectFolder, 'tmp/operations/media-generation/video.json');
    const original = await fs.readFile(file, 'utf8');
    await estimateReviewDraft(state, { reviewId: review.reviewId, requestId: review.requests[0]!.requestId, values: {} }, estimator, homeDir);
    expect(estimator.calls.at(-1)!.request).toEqual({ prompt: 'Rain' });
    expect(await fs.readFile(file, 'utf8')).toBe(original);
  });

  it('omits a nested optional control without removing its unrepresented siblings', async () => {
    const reviewFile = 'tmp/operations/media-generation/nested.json';
    await fs.writeFile(path.join(projectFolder, reviewFile), JSON.stringify({
      provider: charged.provider, model: charged.model, mediaKind: 'video', prompt: 'Rain',
      request: { prompt: 'Rain', duration: 5, options: { 'count/~': 4, seed: 42 } },
    }));
    const state = new GenerationReviewState();
    const estimator = createFakeCostEstimator();
    const review = await openGenerationReview(state, {
      project: 'movie', lane: 'video', requests: [{ reviewFile, routes: [charged], controls: {
        groups: [{ label: 'Settings', fields: [
          ...controls.groups[0]!.fields,
          { key: '/options/count~1~0', label: 'Count', kind: 'integer', initialValue: 4 },
        ] }],
      } }],
    }, estimator, homeDir);
    await estimateReviewDraft(state, { reviewId: review.reviewId, requestId: review.requests[0]!.requestId, values: { '/duration': 10 } }, estimator, homeDir);
    expect(estimator.calls.at(-1)!.request).toEqual({ prompt: 'Rain', duration: 10, options: { seed: 42 } });
  });
});

describe('Generate without asking next time', () => {
  it('turns off Ask Before Generating for the review lane only on submit', async () => {
    const { state, review } = await open();
    await respondToGenerationReview(state, { reviewId: review.reviewId, expectedRevision: review.revision, responseId: 'submit', action: 'submit', drafts: review.drafts, askBeforeGeneratingNextTime: false }, homeDir);
    const settings = (await service.readProjectSettings({ homeDir, projectName: 'movie' })).settings.generation;
    expect(settings.video.askBeforeGenerating).toBe(false);
    expect(settings.image.askBeforeGenerating).toBe(false);
    expect(settings.audio.askBeforeGenerating).toBe(true);
  });

  it('rejects the toggle with any other action and leaves settings unchanged', async () => {
    const { state, review } = await open();
    await expect(respondToGenerationReview(state, { reviewId: review.reviewId, expectedRevision: review.revision, responseId: 'cancel', action: 'cancel', drafts: review.drafts, askBeforeGeneratingNextTime: false }, homeDir))
      .rejects.toMatchObject({ code: 'CODEX_REVIEW_INVALID' });
    expect((await service.readProjectSettings({ homeDir, projectName: 'movie' })).settings.generation.video.askBeforeGenerating).toBe(true);
  });
});
