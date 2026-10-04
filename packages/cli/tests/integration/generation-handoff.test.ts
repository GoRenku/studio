import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { createMemoryProviderMetadataCache } from '@gorenku/studio-engines';
import { afterEach, expect, it, vi } from 'vitest';
import { runRenkuCli } from '../../src/cli.js';
import { executeGenerationRequest } from '../../src/commands/generation/execute.js';
import { validateGenerationRequest } from '../../src/commands/generation/validate.js';
import type { GenerationCommandInput } from '../../src/commands/generation/command.js';
import * as providerRegistry from '../../src/commands/generation/provider-registry.js';
import * as engineContext from '../../src/commands/generation/engine-context.js';

afterEach(() => vi.restoreAllMocks());

it.each([
  { command: 'execute', json: false },
  { command: 'recover', json: true },
])('$command reports completed work on provenance validation failure (json: $json)', async ({ command, json }) => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-handoff-'));
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io = { stdout: { log: (value: string) => stdout.push(value) }, stderr: { error: (value: string) => stderr.push(value) } };
  const storageRoot = path.join(homeDir, 'movies');
  expect(await runRenkuCli(['init', storageRoot], { homeDir, io })).toBe(0);
  await createProjectDataService().createMovieProject({ homeDir, projectName: 'handoff', title: 'Handoff' });
  const projectFolder = path.join(storageRoot, 'handoff');
  const file = 'tmp/operations/media-generation/request.json';
  const document = { provider: 'atlas', model: 'image-v1', mediaKind: 'image',
    prompt: 'Opaque prompt', request: { prompt: 'x'.repeat(1_900_000) } };
  await fs.mkdir(path.dirname(path.join(projectFolder, file)), { recursive: true });
  await fs.writeFile(path.join(projectFolder, file), JSON.stringify(document));
  const outputDirectory = path.join(projectFolder, 'tmp/media/completed');
  const artifactPaths = ['cover.png', 'alternate.png'].map((name) => path.join(outputDirectory, name));
  const completedResult = async () => {
    await fs.mkdir(outputDirectory, { recursive: true });
    for (const artifactPath of artifactPaths) {
      await fs.writeFile(artifactPath, 'completed media');
    }
    return { provider: 'atlas', model: 'image-v1', requestId: 'job_completed',
      receipt: { text: 'y'.repeat(210_000) },
      artifacts: artifactPaths.map((artifactPath) => ({ path: artifactPath, mimeType: 'image/png', byteLength: 15 })) };
  };
  const execute = vi.fn(completedResult);
  const recover = vi.fn(completedResult);
  vi.spyOn(providerRegistry, 'createRenkuMediaEngine').mockReturnValue({
    providerIds: ['atlas'], validate: vi.fn(), readInputSchema: vi.fn(), execute, recover,
  });
  vi.spyOn(engineContext, 'createExecutionContext').mockImplementation(async ({ signal, outputDirectory }) => ({
    credential: 'fixture', signal, outputDirectory,
    metadataCache: createMemoryProviderMetadataCache(), fetch: globalThis.fetch,
    requestTimeoutMs: 1000, operationTimeoutMs: 1000,
  }));
  stdout.length = 0;
  expect(await runRenkuCli(['generation', command, '--project', 'handoff', '--file', file,
    '--output', 'tmp/media/completed',
    ...(command === 'recover' ? ['--request-id', 'job_completed'] : []),
    ...(json ? ['--json'] : [])], { homeDir, io })).toBe(1);
  expect(stdout).toEqual([]);
  expect(stderr).toHaveLength(1);
  const diagnostic = json ? JSON.parse(stderr[0]!).error : { message: stderr[0], suggestion: stderr[0] };
  expect(stderr[0]).toContain('CORE_MEDIA_GENERATION_PROVENANCE_INVALID');
  expect(diagnostic.message).toContain('Provider generation completed');
  expect(diagnostic.suggestion).toContain('Do not submit another generation.');
  expect(diagnostic.suggestion).toContain('Provider request: job_completed.');
  expect(diagnostic.suggestion).toContain('exceeds 2097152 bytes');
  for (const artifactPath of artifactPaths) {
    expect(diagnostic.suggestion).toContain(artifactPath);
    expect(await fs.readFile(artifactPath, 'utf8')).toBe('completed media');
  }
  expect(await fs.readdir(outputDirectory)).toEqual(['alternate.png', 'cover.png']);
  expect(execute).toHaveBeenCalledTimes(command === 'execute' ? 1 : 0);
  expect(recover).toHaveBeenCalledTimes(command === 'recover' ? 1 : 0);
});

it('executes a validated request, imports its saved provenance, and exposes it through Inspection', async () => {
  const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-handoff-'));
  const stdout: string[] = [];
  const stderr: string[] = [];
  const io = { stdout: { log: (value: string) => stdout.push(value) }, stderr: { error: (value: string) => stderr.push(value) } };
  const storageRoot = path.join(homeDir, 'movies');
  expect(await runRenkuCli(['init', storageRoot], { homeDir, io })).toBe(0);
  const service = createProjectDataService();
  await service.createMovieProject({ homeDir, projectName: 'handoff', title: 'Handoff' });
  const projectFolder = path.join(storageRoot, 'handoff');
  const file = 'tmp/operations/media-generation/request.json';
  const document = { provider: 'atlas', model: 'image-v1', mediaKind: 'image',
    prompt: 'Exact opaque prompt', request: { prompt: 'Transformed native prompt' } };
  await fs.mkdir(path.dirname(path.join(projectFolder, file)), { recursive: true });
  await fs.writeFile(path.join(projectFolder, file), JSON.stringify(document));
  const receipt = { text: 'opaque receipt '.repeat(3000), seed: 0 };
  const execute = vi.fn(async (_provider, _request, context) => {
    await fs.mkdir(context.outputDirectory, { recursive: true });
    const artifactPath = path.join(context.outputDirectory, 'cover.png');
    const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
    await fs.writeFile(artifactPath, bytes);
    return { provider: 'atlas', model: 'image-v1', requestId: 'job_1', receipt,
      artifacts: [{ path: artifactPath, mimeType: 'image/png', byteLength: bytes.length }] };
  });
  const recover = vi.fn();
  const context = (signal: AbortSignal) => ({ credential: 'fixture', signal,
    metadataCache: createMemoryProviderMetadataCache(), fetch: globalThis.fetch,
    requestTimeoutMs: 1000, operationTimeoutMs: 1000 });
  const input: GenerationCommandInput = {
    flags: { file, output: 'tmp/media/cover' },
    runtime: { homeDir, projectName: 'handoff', projectDataService: service, io, json: true,
      mediaEngine: { providerIds: ['atlas'], validate: vi.fn(), readInputSchema: vi.fn(), execute, recover },
      createProviderContext: async ({ signal }) => context(signal),
      createProviderExecutionContext: async ({ signal, outputDirectory }) => ({ ...context(signal), outputDirectory }),
    },
  };
  const validated = await validateGenerationRequest(input);
  input.flags.expectedRequestSha256 = validated.requestSha256;
  const result = await executeGenerationRequest(input);
  stdout.length = 0;
  expect(await runRenkuCli(['media', 'import', '--project', 'handoff', '--purpose', 'project.cover',
    '--target', 'project', '--source', path.relative(projectFolder, result.artifacts[0]!.path),
    '--provenance', result.provenancePath, '--json'], { homeDir, io }), stderr.join('\n')).toBe(0);
  const attachment = JSON.parse(stdout.join('\n'));
  expect(attachment.assetFile.generationProvenance).toEqual({ ...document, receipt });
  const inspection = await service.readAssetFileMediaGenerationRequest({ homeDir, projectName: 'handoff', assetFileId: attachment.assetFile.id });
  expect(inspection).toMatchObject({ prompt: document.prompt, provider: 'atlas', model: 'image-v1', editable: false });
  expect(execute).toHaveBeenCalledOnce();
  expect(recover).not.toHaveBeenCalled();

  await service.updateMediaGenerationPreviewPrompt({ homeDir, projectName: 'handoff', documentPath: file, prompt: 'Edited in Preview' });
  stdout.length = 0;
  expect(await runRenkuCli(['generation', 'execute', '--project', 'handoff', '--file', file,
    '--output', 'tmp/media/changed', '--expected-request-sha256', validated.requestSha256, '--json'], { homeDir, io })).toBe(1);
  expect(stderr.join('\n')).toContain('CLI_GENERATION_REQUEST_CHANGED');
  expect(stdout).toEqual([]);

  const edited = JSON.parse(await fs.readFile(path.join(projectFolder, file), 'utf8'));
  edited.request.prompt = 'Native: Edited in Preview';
  await fs.writeFile(path.join(projectFolder, file), JSON.stringify(edited));
  const revalidated = await validateGenerationRequest(input);
  expect(revalidated.requestSha256).not.toBe(validated.requestSha256);
  input.flags.expectedRequestSha256 = revalidated.requestSha256;
  const revised = await executeGenerationRequest(input);
  expect(revised.provenance).toMatchObject({ prompt: 'Edited in Preview', request: { prompt: 'Native: Edited in Preview' } });
  expect(recover).not.toHaveBeenCalled();

  vi.spyOn(providerRegistry, 'createRenkuMediaEngine').mockReturnValue(input.runtime.mediaEngine!);
  vi.spyOn(engineContext, 'createExecutionContext').mockImplementation(input.runtime.createProviderExecutionContext!);
  const closedOutput = { stdout: { log: () => { throw new Error('Consumer closed'); } }, stderr: io.stderr };
  expect(await runRenkuCli(['generation', 'execute', '--project', 'handoff', '--file', file,
    '--output', 'tmp/media/closed-output', '--expected-request-sha256', revalidated.requestSha256],
  { homeDir, io: closedOutput })).toBe(1);
  const closedDirectory = path.join(projectFolder, 'tmp/media/closed-output');
  const saved = (await fs.readdir(closedDirectory)).filter((name) => name.endsWith('.json'));
  expect(saved).toHaveLength(1);
  expect(JSON.parse(await fs.readFile(path.join(closedDirectory, saved[0]!), 'utf8'))).toEqual(revised.provenance);
  expect(execute).toHaveBeenCalledTimes(3);
  expect(recover).not.toHaveBeenCalled();
});
