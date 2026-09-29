import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseMediaGenerationReviewDocument, type MediaGenerationReviewDocument } from '@gorenku/studio-core/server';
import { readProvenance } from '../media-import-documents.js';
import { saveGenerationExecutionResult } from './execution-result.js';
import { renderGenerationExecution } from './execution-output.js';

afterEach(() => vi.restoreAllMocks());

const document: MediaGenerationReviewDocument = {
  provider: 'atlas', model: 'exact/provider-route', mediaKind: 'video',
  prompt: 'Opaque\n雪  ', request: { prompt: 'Native prompt', duration: 0, enabled: false },
};

describe('generation execution handoff', () => {
  it.each(['image', 'audio', 'video'] as const)('preserves %s provenance without provider/model-specific interpretation', async (mediaKind) => {
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-result-'));
    const request = { ...document, mediaKind, model: 'unlisted/exact-route' };
    const report = await saveGenerationExecutionResult(request, {
      provider: request.provider, model: request.model, artifacts: [],
    }, outputDirectory);
    expect(await readProvenance(report.provenancePath)).toEqual(request);
    expect(report).not.toHaveProperty('requestId');
  });

  it('saves exact import-ready provenance and displays all artifacts without echoing the receipt', async () => {
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-result-'));
    const result = {
      provider: document.provider, model: document.model, requestId: 'job_1',
      artifacts: [
        { path: path.join(outputDirectory, 'video.mp4'), mimeType: 'video/mp4', byteLength: 20 },
        { path: path.join(outputDirectory, 'audio.wav'), mimeType: 'audio/wav', byteLength: 10 },
      ],
      receipt: { opaque: 'long provider text '.repeat(5000), nested: [null, false, 0] },
    };
    const report = await saveGenerationExecutionResult(document, result, outputDirectory);
    expect(await readProvenance(report.provenancePath)).toEqual({ ...document, receipt: result.receipt });
    expect((await fs.stat(report.provenancePath)).mode & 0o777).toBe(0o600);
    expect(await fs.readdir(outputDirectory)).toEqual([path.basename(report.provenancePath)]);
    const rendered = renderGenerationExecution(report);
    expect(rendered).not.toContain('long provider text');
    expect(rendered).toContain(report.provenancePath);
    for (const artifact of result.artifacts) {
      expect(rendered).toContain(artifact.path);
    }
    expect(JSON.parse(rendered.slice(rendered.indexOf('\n') + 1))).toEqual({
      requestId: result.requestId, artifacts: result.artifacts, provenancePath: report.provenancePath,
    });
    const second = await saveGenerationExecutionResult(document, result, outputDirectory);
    expect(second.provenancePath).not.toBe(report.provenancePath);
    expect(await readProvenance(report.provenancePath)).toEqual(report.provenance);
  });

  it('identifies completed media on write failure without placing the receipt in the error', async () => {
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-result-'));
    const mediaPath = path.join(outputDirectory, 'video.mp4');
    await fs.writeFile(mediaPath, 'completed media');
    vi.spyOn(fs, 'writeFile').mockRejectedValueOnce(new Error('Disk full'));
    await expect(saveGenerationExecutionResult(document, {
      provider: document.provider, model: document.model, requestId: 'job_1',
      artifacts: [{ path: mediaPath, mimeType: 'video/mp4', byteLength: 15 }],
      receipt: { text: 'Private large receipt' },
    }, outputDirectory)).rejects.toMatchObject({
      code: 'CLI_GENERATION_PROVENANCE_WRITE_FAILED',
      message: expect.stringContaining('Provider generation completed'),
      suggestion: expect.stringContaining(mediaPath),
    });
    expect(await fs.readFile(mediaPath, 'utf8')).toBe('completed media');
  });

  it('identifies completed work when a receipt exceeds Core provenance limits', async () => {
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-result-'));
    const mediaPath = path.join(outputDirectory, 'video.mp4');
    await fs.writeFile(mediaPath, 'completed media');
    const request = parseMediaGenerationReviewDocument({
      ...document, request: { prompt: 'x'.repeat(1_900_000) },
    });
    const result = {
      provider: document.provider, model: document.model, requestId: 'job_completed',
      artifacts: [{ path: mediaPath, mimeType: 'video/mp4', byteLength: 15 }],
      receipt: { text: 'y'.repeat(210_000) },
    };
    const error = await saveGenerationExecutionResult(request, result, outputDirectory).catch((error) => error);
    expect(error).toMatchObject({
      code: 'CORE_MEDIA_GENERATION_PROVENANCE_INVALID',
      message: expect.stringContaining('Provider generation completed'),
    });
    expect(error.suggestion).toContain('Do not submit another generation.');
    expect(error.suggestion).toContain('Provider request: job_completed.');
    expect(error.suggestion).toContain(mediaPath);
    expect(error.suggestion).toContain('exceeds 2097152 bytes');
    expect(JSON.stringify(error)).not.toContain(result.receipt.text);
    expect(await fs.readFile(mediaPath, 'utf8')).toBe('completed media');
    expect(await fs.readdir(outputDirectory)).toEqual(['video.mp4']);
  });

  it('retains complete temporary provenance when publication fails', async () => {
    const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-result-'));
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('Publication failed'));
    await expect(saveGenerationExecutionResult(document, {
      provider: document.provider, model: document.model, artifacts: [],
    }, outputDirectory)).rejects.toMatchObject({
      code: 'CLI_GENERATION_PROVENANCE_WRITE_FAILED',
      suggestion: expect.stringContaining('Complete provenance is retained at'),
    });
    const [temporary] = await fs.readdir(outputDirectory);
    expect(temporary).toMatch(/\.json\.tmp$/);
    expect(await readProvenance(path.join(outputDirectory, temporary!))).toEqual(document);
  });
});
