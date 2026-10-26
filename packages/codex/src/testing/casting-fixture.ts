import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import type { AssetFile, CastingRoundSubject, CastLook } from '@gorenku/studio-core/client';
import { createProjectDataService, initRenkuConfig, syncDefaultModelList } from '@gorenku/studio-core/server';
import { openCurrentProject } from '@gorenku/studio-core/server/project-selection';
import { createCodexServer } from '../server.js';
import type { GenerationCostEstimator } from '../generation-review-estimate.js';
import { createFakeCostEstimator } from './fake-cost-estimator.js';

/** Fictional image-lane models: the casting panels list whatever the Skill's Default Model List names. */
export const CASTING_DEFAULT_MODELS = {
  formatVersion: 1,
  lanes: {
    image: [
      { model: 'acme-portrait', name: 'Acme Portrait', providers: [{ provider: 'fal-ai', route: 'route/acme-portrait', detail: { lowest: { size: 'small' }, mid: { size: 'medium' }, highest: { size: 'large' } } }, { provider: 'replicate', route: 'route/acme-portrait', detail: { lowest: { size: 'small' }, mid: { size: 'medium' }, highest: { size: 'large' } } }], recommendedFor: ['fal-ai'] },
      { model: 'acme-faces', name: 'Acme Faces', providers: [{ provider: 'fal-ai', route: 'route/acme-faces', detail: { lowest: { size: 'small' }, mid: { size: 'medium' }, highest: { size: 'large' } } }], recommendedFor: [] },
      { model: 'acme-host-image', name: 'Acme Host Image', providers: [{ provider: 'codex', route: 'route/acme-host-image', detail: { lowest: { size: 'small' }, mid: { size: 'medium' }, highest: { size: 'large' } } }], recommendedFor: ['codex'] },
    ],
    imageEdit: [],
    video: [],
    audio: [],
  },
};

export interface CastingFixture {
  root: string;
  homeDir: string;
  projectFolder: string;
  client: Client;
  server: ReturnType<typeof createCodexServer>;
  service: ReturnType<typeof createProjectDataService>;
  castMemberId: string;
  sceneIds: string[];
  looks: { young: CastLook; older: CastLook };
  call: <T>(name: string, input: Record<string, unknown>) => Promise<T>;
  callError: (name: string, input: Record<string, unknown>) => Promise<{ error: { code: string; message: string }; issues?: Array<{ message: string }> }>;
  createRound: (subject: CastingRoundSubject, routes?: Array<{ provider: string; model: { key: string; name: string }; count: number }>) => Promise<string>;
  importCandidate: (roundId: string, modelKey: string) => Promise<AssetFile>;
  importSheet: (roundId: string, modelKey: string) => Promise<AssetFile>;
  close: () => Promise<void>;
}

/** A Project with one Cast Member, three scenes and two Looks, served by a connected Codex MCP server. */
export async function createCastingFixture(options: { estimator?: GenerationCostEstimator; syncModels?: boolean } = {}): Promise<CastingFixture> {
  const service = createProjectDataService();
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-casting-panels-'));
  const homeDir = path.join(root, 'home');
  await initRenkuConfig(path.join(root, 'movies'), { homeDir });
  await fs.writeFile(path.join(homeDir, '.config', 'renku', '.env'), 'FAL_KEY=test-key\nREPLICATE_API_TOKEN=test-token\n');
  const projectFolder = (await service.createMovieProject({ homeDir, projectName: 'movie', title: 'Casting fixture' })).projectPath;
  await openCurrentProject({ homeDir, projectName: 'movie' });
  await service.applyCastOperations({
    homeDir, projectName: 'movie',
    document: { kind: 'castOperations', operations: [{ operation: 'castMember.add', castMember: { key: 'ana', handle: 'ana', name: 'Ana Komnene' } }] },
  } as never);
  const castMemberId = (await service.listCastMembers({ homeDir })).find((member) => member.handle === 'ana')!.id;
  await service.applyScreenplayOperations({
    homeDir, projectName: 'movie',
    operations: ['harbor', 'palace', 'walls'].map((key) => ({
      operation: 'scene.add', scene: { key, heading: `EXT. ${key.toUpperCase()} - DAY`, blocks: [] }, structureEntryKey: `${key}-entry`, placement: { at: 'end' },
    })),
  } as never);
  const sceneIds = (await service.readScreenplayStructure({ homeDir, projectName: 'movie' })).screenplay.scenes.map((scene) => scene.id);
  const written = await service.writeCastLooksPlan({
    homeDir, projectName: 'movie',
    document: { kind: 'castLooksPlan', castMemberId, looks: [{ name: 'Young', sceneIds: [sceneIds[0]!] }, { name: 'Older', sceneIds: sceneIds.slice(1) }] },
  });
  if (options.syncModels !== false) {
    const file = path.join(root, 'default-models.json');
    await fs.writeFile(file, JSON.stringify(CASTING_DEFAULT_MODELS));
    await syncDefaultModelList({ homeDir, file });
  }
  const html = path.join(root, 'app.html');
  await fs.writeFile(html, '<!doctype html><html><body>Panel</body></html>');
  await fs.mkdir(path.join(projectFolder, 'tmp'), { recursive: true });
  const server = createCodexServer({
    version: 'test', generationReviewHtml: html, dialogueDirectionHtml: html, imageEditHtml: html, imageEditTargetChooserHtml: html, routeChooserHtml: html,
    castingRoundHtml: html, castingBoardHtml: html, castingWardrobeHtml: html, costEstimator: options.estimator ?? createFakeCostEstimator(), homeDir,
  });
  const client = new Client({ name: 'codex-mcp-client', version: '1.0.0' }, { capabilities: { extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: [RESOURCE_MIME_TYPE] } } } as never });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  let fileCount = 0;
  const importRoundImage = async (purpose: 'cast.casting-candidate' | 'cast.character-sheet', roundId: string, modelKey: string) => {
    fileCount += 1;
    const relativePath = `tmp/round-image-${fileCount}.png`;
    await fs.writeFile(path.join(projectFolder, relativePath), `round image ${fileCount}`);
    const report = await service.attachGenerationMedia({
      homeDir, projectName: 'movie', purpose, target: { kind: 'castingRound', id: roundId },
      sourceProjectRelativePath: relativePath, castingModelKey: modelKey,
    } as never);
    return report.assetFile as AssetFile;
  };

  return {
    root, homeDir, projectFolder, client, server, service, castMemberId, sceneIds,
    looks: { young: written.looks[0]!, older: written.looks[1]! },
    async call<T>(name: string, input: Record<string, unknown>): Promise<T> {
      const result = await client.callTool({ name, arguments: input });
      if (result.isError) throw Object.assign(new Error(JSON.stringify(result.structuredContent)), { structuredContent: result.structuredContent });
      return result.structuredContent as T;
    },
    async callError(name, input) {
      const result = await client.callTool({ name, arguments: input });
      if (!result.isError) throw new Error(`${name} unexpectedly succeeded.`);
      return result.structuredContent as never;
    },
    async createRound(subject, routes = [{ provider: 'fal-ai', model: { key: 'acme-portrait', name: 'Acme Portrait' }, count: 2 }, { provider: 'fal-ai', model: { key: 'acme-faces', name: 'Acme Faces' }, count: 1 }]) {
      return (await service.createCastingRound({
        homeDir, projectName: 'movie',
        document: { kind: 'castingRoundCreate', subject, routes, maxConcurrentGenerations: 2, referenceAssetFileIds: [], estimatedCost: null },
      })).round.id;
    },
    importCandidate: (roundId, modelKey) => importRoundImage('cast.casting-candidate', roundId, modelKey),
    importSheet: (roundId, modelKey) => importRoundImage('cast.character-sheet', roundId, modelKey),
    async close() {
      await client.close();
      await server.close();
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}
