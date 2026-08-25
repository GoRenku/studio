import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryProviderMetadataCache, EngineError } from '@gorenku/studio-engines';
import { executeGenerationRequest } from './execute.js';
import { recoverGenerationRequest } from './recover.js';
import { validateGenerationRequest } from './validate.js';

describe('generation CLI provider delegation', () => {
  it('parses once, resolves local media, delegates once, and serializes safe provenance', async () => {
    const fixture = await requestFixture();
    const execute = vi.fn(async (_provider, request) => {
      expect(request).toEqual({
        model: 'atlas/image-v1',
        input: {
          prompt: 'A stone arch',
          image: { $file: path.join(fixture.projectFolder, 'media/reference.png'), mimeType: 'image/png' },
        },
      });
      return {
        provider: 'atlas',
        model: request.model,
        requestId: 'atlas_job_1',
        artifacts: [{ path: path.join(fixture.projectFolder, 'generated/output.png'), mimeType: 'image/png', byteLength: 12 }],
        receipt: { job: 'atlas_job_1' },
      };
    });
    const result = await executeGenerationRequest(commandInput(fixture, {
      mediaEngine: { validate: vi.fn(), execute, recover: vi.fn() },
    }));
    expect(execute).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      requestId: 'atlas_job_1',
      provenance: {
        provider: 'atlas',
        model: 'atlas/image-v1',
        mediaKind: 'image',
        prompt: 'A stone arch',
        receipt: { job: 'atlas_job_1' },
      },
    });
    expect(JSON.stringify(result)).not.toContain('test-credential');
  });

  it('delegates validate and recover without provider protocol branches', async () => {
    const fixture = await requestFixture();
    const validate = vi.fn(async () => undefined);
    const recover = vi.fn(async (_provider, request) => ({ provider: 'atlas', model: request.model, requestId: request.requestId, artifacts: [] }));
    const mediaEngine = { validate, execute: vi.fn(), recover };
    await expect(validateGenerationRequest(commandInput(fixture, { mediaEngine }))).resolves.toMatchObject({ valid: true, provider: 'atlas' });
    await expect(recoverGenerationRequest(commandInput(fixture, { mediaEngine }, { requestId: 'job_2' }))).resolves.toMatchObject({ requestId: 'job_2' });
    expect(validate).toHaveBeenCalledOnce();
    expect(recover).toHaveBeenCalledOnce();
  });

  it('maps a closed EngineError without exposing provider protocol details', async () => {
    const fixture = await requestFixture();
    await expect(validateGenerationRequest(commandInput(fixture, {
      mediaEngine: {
        validate: async () => { throw new EngineError('ENGINE_REQUEST_INVALID', 'Invalid request.', { provider: 'atlas', model: 'atlas/image-v1' }); },
        execute: vi.fn(),
        recover: vi.fn(),
      },
    }))).rejects.toMatchObject({ code: 'ENGINE_REQUEST_INVALID' });
  });
});

async function requestFixture() {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cli-provider-'));
  const projectName = 'atlas-movie';
  const projectFolder = path.join(storageRoot, projectName);
  const documentPath = 'tmp/operations/media-generation/request.json';
  await fs.mkdir(path.join(projectFolder, path.dirname(documentPath)), { recursive: true });
  await fs.mkdir(path.join(projectFolder, 'media'), { recursive: true });
  await fs.writeFile(path.join(projectFolder, 'media/reference.png'), 'reference');
  await fs.writeFile(path.join(projectFolder, documentPath), JSON.stringify({
    provider: 'atlas',
    model: 'atlas/image-v1',
    mediaKind: 'image',
    prompt: 'A stone arch',
    request: { prompt: 'A stone arch', image: { $file: 'media/reference.png', mimeType: 'image/png' } },
  }));
  return { storageRoot, projectName, projectFolder, documentPath };
}

function commandInput(
  fixture: Awaited<ReturnType<typeof requestFixture>>,
  overrides: Record<string, unknown>,
  flags: { requestId?: string } = {},
) {
  return {
    flags: { file: fixture.documentPath, output: 'generated', ...flags },
    runtime: {
      projectName: fixture.projectName,
      projectDataService: {
        resolveStudioProjectRef: async () => ({ id: 'project_1', name: fixture.projectName, storageRoot: fixture.storageRoot }),
      },
      createProviderContext: async ({ signal }: { signal: AbortSignal }) => providerContext(signal),
      createProviderExecutionContext: async ({ signal, outputDirectory }: { signal: AbortSignal; outputDirectory: string }) => ({ ...providerContext(signal), outputDirectory }),
      ...overrides,
    },
  } as never;
}

function providerContext(signal: AbortSignal) {
  return { credential: 'test-credential', metadataCache: createMemoryProviderMetadataCache(), fetch: globalThis.fetch, signal, requestTimeoutMs: 1_000, operationTimeoutMs: 5_000 };
}
