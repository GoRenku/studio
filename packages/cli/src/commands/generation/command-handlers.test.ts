import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createMemoryProviderMetadataCache, EngineError } from '@gorenku/studio-engines';
import { createProjectDataService, initRenkuConfig } from '@gorenku/studio-core/server';
import { executeGenerationRequest } from './execute.js';
import { recoverGenerationRequest } from './recover.js';
import { validateGenerationRequest } from './validate.js';
import { showGenerationSchema } from './schema.js';

describe('generation CLI provider delegation', () => {
  it('parses once, resolves local media, delegates once, and serializes safe provenance', async () => {
    const fixture = await requestFixture();
    const execute = vi.fn(async (_provider, request) => {
      expect(request).toEqual({
        model: 'atlas/image-v1',
        input: {
          prompt: 'A stone arch',
          image: {
            $file: path.join(fixture.projectFolder, 'media/reference.png'),
            mimeType: 'image/png',
            reviewLabel: 'Stone arch reference',
            promptMention: '@Image1',
          },
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
      mediaEngine: { providerIds: [], readInputSchema: vi.fn(), validate: vi.fn(), execute, recover: vi.fn() },
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
    expect(JSON.parse(await fs.readFile(result.provenancePath, 'utf8'))).toEqual(result.provenance);
  });

  it('delegates validate and recover without provider protocol branches', async () => {
    const fixture = await requestFixture();
    const validate = vi.fn(async () => undefined);
    const recover = vi.fn(async (_provider, request) => ({ provider: 'atlas', model: request.model, requestId: request.requestId, artifacts: [] }));
    const mediaEngine = { providerIds: [], readInputSchema: vi.fn(), validate, execute: vi.fn(), recover };
    await expect(validateGenerationRequest(commandInput(fixture, { mediaEngine }))).resolves.toMatchObject({ valid: true, provider: 'atlas' });
    await expect(recoverGenerationRequest(commandInput(fixture, { mediaEngine }, { requestId: 'job_2' }))).resolves.toMatchObject({ requestId: 'job_2' });
    expect(validate).toHaveBeenCalledOnce();
    expect(recover).toHaveBeenCalledOnce();
  });

  it('maps a closed EngineError without exposing provider protocol details', async () => {
    const fixture = await requestFixture();
    await expect(validateGenerationRequest(commandInput(fixture, {
      mediaEngine: { providerIds: [],
        readInputSchema: vi.fn(),
        validate: async () => { throw new EngineError('ENGINE_REQUEST_INVALID', 'Invalid request.', { provider: 'atlas', model: 'atlas/image-v1' }); },
        execute: vi.fn(),
        recover: vi.fn(),
      },
    }))).rejects.toMatchObject({ code: 'ENGINE_REQUEST_INVALID' });
  });

  it('executes the exact validated bytes and retains that document even if the file changes during execution', async () => {
    const fixture = await requestFixture();
    const requestPath = path.join(fixture.projectFolder, fixture.documentPath);
    const original = await fs.readFile(requestPath);
    const execute = vi.fn(async () => {
      await fs.writeFile(requestPath, '{}');
      return { provider: 'atlas', model: 'atlas/image-v1', artifacts: [] };
    });
    const mediaEngine = { providerIds: [], readInputSchema: vi.fn(), validate: vi.fn(), execute, recover: vi.fn() };
    const validated = await validateGenerationRequest(commandInput(fixture, { mediaEngine }));
    expect(validated.requestSha256).toBe(createHash('sha256').update(original).digest('hex'));
    const report = await executeGenerationRequest(commandInput(fixture, { mediaEngine }, {
      expectedRequestSha256: validated.requestSha256,
    }));
    expect(execute).toHaveBeenCalledOnce();
    expect(report.provenance.prompt).toBe('A stone arch');
    expect(JSON.parse(await fs.readFile(report.provenancePath, 'utf8'))).toEqual(report.provenance);
  });

  it.each(['prompt', 'request', 'whitespace'])('stops before provider work after a %s edit', async (edit) => {
    const fixture = await requestFixture();
    const requestPath = path.join(fixture.projectFolder, fixture.documentPath);
    const original = await fs.readFile(requestPath, 'utf8');
    const expectedRequestSha256 = createHash('sha256').update(original).digest('hex');
    const document = JSON.parse(original);
    const changed = { ...document, [edit]: 'Changed value' };
    await fs.writeFile(requestPath, edit === 'whitespace' ? `${original}\n` : JSON.stringify(changed));
    const execute = vi.fn();
    const createProviderExecutionContext = vi.fn();
    await expect(executeGenerationRequest(commandInput(fixture, {
      createProviderExecutionContext,
      mediaEngine: { execute },
    }, { expectedRequestSha256 }))).rejects.toMatchObject({ code: 'CLI_GENERATION_REQUEST_CHANGED' });
    expect(execute).not.toHaveBeenCalled();
    expect(createProviderExecutionContext).not.toHaveBeenCalled();
  });

  it('rejects a malformed digest before provider work', async () => {
    const fixture = await requestFixture();
    const execute = vi.fn();
    await expect(executeGenerationRequest(commandInput(fixture, {
      mediaEngine: { execute },
    }, { expectedRequestSha256: 'invalid' }))).rejects.toMatchObject({ code: 'CLI_GENERATION_REQUEST_HASH_INVALID' });
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns the raw live provider schema without normalizing it', async () => {
    const fixture = await requestFixture();
    const schema = { type: 'object', properties: { image_url: { type: 'string', format: 'uri' } } };
    const readInputSchema = vi.fn(async () => schema);
    await expect(showGenerationSchema(commandInput(fixture, {
      mediaEngine: { providerIds: [], readInputSchema, validate: vi.fn(), execute: vi.fn(), recover: vi.fn() },
    }, { provider: 'atlas', model: 'atlas/image-v1', output: undefined }))).resolves.toBe(schema);
    expect(readInputSchema).toHaveBeenCalledWith('atlas', 'atlas/image-v1', expect.any(Object));
  });

  it('can persist the raw live provider schema for a cache refresh', async () => {
    const fixture = await requestFixture();
    const schema = { type: 'object', properties: { quality: { enum: ['low', 'high'] } } };
    const output = path.join(fixture.storageRoot, 'schema.json');
    const readInputSchema = vi.fn(async () => schema);
    await expect(showGenerationSchema(commandInput(fixture, {
      mediaEngine: { providerIds: [], readInputSchema, validate: vi.fn(), execute: vi.fn(), recover: vi.fn() },
    }, { provider: 'atlas', model: 'atlas/image-v1', output }))).resolves.toEqual({
      schema,
      outputPath: output,
    });
    await expect(fs.readFile(output, 'utf8')).resolves.toBe(`${JSON.stringify(schema, null, 2)}\n`);
  });
});

async function requestFixture() {
  const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cli-provider-'));
  const projectName = 'atlas-movie';
  const projectFolder = path.join(storageRoot, projectName);
  const homeDir = path.join(storageRoot, 'test-home');
  const projectDataService = createProjectDataService();
  await initRenkuConfig(storageRoot, { homeDir });
  await projectDataService.createMovieProject({ homeDir, projectName, title: 'CLI generation fixture' });
  const documentPath = 'tmp/operations/media-generation/request.json';
  await fs.mkdir(path.join(projectFolder, path.dirname(documentPath)), { recursive: true });
  await fs.mkdir(path.join(projectFolder, 'media'), { recursive: true });
  await fs.writeFile(path.join(projectFolder, 'media/reference.png'), 'reference');
  await fs.writeFile(path.join(projectFolder, documentPath), JSON.stringify({
    provider: 'atlas',
    model: 'atlas/image-v1',
    mediaKind: 'image',
    prompt: 'A stone arch',
    request: { prompt: 'A stone arch', image: { $file: 'media/reference.png', mimeType: 'image/png', reviewLabel: 'Stone arch reference', promptMention: '@Image1' } },
  }));
  return { storageRoot, projectName, projectFolder, documentPath, homeDir, projectDataService };
}

function commandInput(
  fixture: Awaited<ReturnType<typeof requestFixture>>,
  overrides: Record<string, unknown>,
  flags: { requestId?: string; provider?: string; model?: string; output?: string; expectedRequestSha256?: string } = {},
) {
  return {
    flags: { file: fixture.documentPath, output: 'generated', ...flags },
    runtime: {
      projectName: fixture.projectName,
      homeDir: fixture.homeDir,
      projectDataService: fixture.projectDataService,
      createProviderContext: async ({ signal }: { signal: AbortSignal }) => providerContext(signal),
      createProviderExecutionContext: async ({ signal, outputDirectory }: { signal: AbortSignal; outputDirectory: string }) => ({ ...providerContext(signal), outputDirectory }),
      ...overrides,
    },
  } as never;
}

function providerContext(signal: AbortSignal) {
  return { credential: 'test-credential', metadataCache: createMemoryProviderMetadataCache(), fetch: globalThis.fetch, signal, requestTimeoutMs: 1_000, operationTimeoutMs: 5_000 };
}
