import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerateWorldLabsLocationWorldInput } from '@gorenku/studio-engines';
import type { LocationWorldGenerationDocument } from '../../client/index.js';
import { normalizeProjectRelativePath } from '../files/project-relative-paths.js';
import { createProjectDataService } from '../project-data-service.js';
import { writeConfig } from '../testing/project-data-fixtures.js';
import { createIsolatedSampleMovieProjectFromTemplate } from '../testing/movie-project-template-fixtures.js';
import { generateLocationWorld } from './generation.js';

describe('Location World generation', () => {
  let homeDir: string;
  let projectFolder: string;
  let locationId: string;
  let document: LocationWorldGenerationDocument;
  let multiImages: Extract<
    LocationWorldGenerationDocument['source'],
    { kind: 'multiImage' }
  >['images'];

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-location-world-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    const projectData = createProjectDataService();
    const created = await createIsolatedSampleMovieProjectFromTemplate({
      homeDir,
      projectData,
    });
    if (!created) {
      throw new Error('Sample Project fixture is unavailable.');
    }
    projectFolder = created.projectPath;
    const locations = await projectData.listLocations({ homeDir });
    locationId = locations[0]!.id;
    const panoramaPath = normalizeProjectRelativePath(
      'tmp/media/location-world/panorama.png'
    );
    await fs.mkdir(path.dirname(path.join(projectFolder, panoramaPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(projectFolder, panoramaPath), 'panorama');
    multiImages = [];
    for (const index of [0, 1, 2, 3]) {
      const projectRelativePath = normalizeProjectRelativePath(
        `tmp/media/location-world/view-${index}.png`
      );
      const absolutePath = path.join(projectFolder, projectRelativePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, `image ${index}`);
      multiImages.push({ projectRelativePath });
    }
    document = {
      kind: 'locationWorldGeneration',
      version: 1,
      locationId,
      prompt: 'A precise exterior reconstruction.',
      source: {
        kind: 'panorama',
        projectRelativePath: panoramaPath,
      },
    };
  });

  it('persists one selected local SPZ without changing the Location hero surface', async () => {
    const projectData = createProjectDataService();
    const before = await projectData.readLocationResource({
      projectName: 'constantinople',
      homeDir,
      locationId,
    });
    const generate = vi.fn(async (_input: GenerateWorldLabsLocationWorldInput) => ({
      operationId: 'operation_1',
      worldId: 'world_1',
      body: new Response(new TextEncoder().encode('durable spz')).body!,
      contentLength: 11,
      mediaKind: 'model' as const,
      mimeType: 'application/octet-stream' as const,
      extension: 'spz' as const,
    }));

    const report = await generateLocationWorld(
      { homeDir, document },
      { generate }
    );

    expect(generate).toHaveBeenCalledOnce();
    const providerInput = generate.mock.calls[0]![0];
    expect(providerInput.source).toMatchObject({
      kind: 'panorama',
      image: {
        fileName: 'panorama.png',
        extension: 'png',
        mimeType: 'image/png',
      },
    });
    expect(report.asset).toMatchObject({
      type: 'location_world',
      mediaKind: 'model',
      origin: 'world-labs',
    });
    expect(report.asset.files).toHaveLength(1);
    expect(report.asset.files[0]!.projectRelativePath).toMatch(
      /^locations\/[a-z0-9-]+\/world-g[0123456789abcdefghjkmnpqrstvwxyz]{3}\.spz$/
    );
    await expect(fs.readFile(
      path.join(projectFolder, report.asset.files[0]!.projectRelativePath),
      'utf8'
    )).resolves.toBe('durable spz');
    const after = await projectData.readLocationResource({
      projectName: 'constantinople',
      homeDir,
      locationId,
    });
    expect(after.firstImage).toEqual(before.firstImage);
    expect(after.selectedWorld?.id).toBe(report.asset.id);
    const page = await projectData.listAssetPage({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: locationId },
      type: 'location_world',
    });
    expect(page.selectedAssetId).toBe(report.asset.id);
    expect(page.items.map((asset) => asset.id)).toEqual([report.asset.id]);
  });

  it('retains two-to-eight-image reconstruction input', async () => {
    const generate = vi.fn(async (_input: GenerateWorldLabsLocationWorldInput) => (
      generatedWorld('durable spz')
    ));

    await generateLocationWorld(
      {
        homeDir,
        document: {
          ...document,
          source: { kind: 'multiImage', images: multiImages },
        },
      },
      { generate }
    );

    expect(generate).toHaveBeenCalledOnce();
    const providerInput = generate.mock.calls[0]![0];
    expect(providerInput.source.kind).toBe('multiImage');
    if (providerInput.source.kind !== 'multiImage') {
      throw new Error('Expected multi-image provider input.');
    }
    expect(providerInput.source.images).toHaveLength(4);
  });

  it('rejects fewer than two reconstruction images before calling World Labs', async () => {
    const generate = vi.fn();
    await expect(generateLocationWorld(
      {
        homeDir,
        document: {
          ...document,
          source: { kind: 'multiImage', images: multiImages.slice(0, 1) },
        },
      },
      { generate }
    )).rejects.toMatchObject({ code: 'LOCATION_WORLD_INPUT_INVALID' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects more than eight reconstruction images before calling World Labs', async () => {
    const generate = vi.fn();
    await expect(generateLocationWorld(
      {
        homeDir,
        document: {
          ...document,
          source: {
            kind: 'multiImage',
            images: Array.from(
              { length: 9 },
              (_, index) => multiImages[index % multiImages.length]!
            ),
          },
        },
      },
      { generate }
    )).rejects.toMatchObject({ code: 'LOCATION_WORLD_INPUT_INVALID' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects unsupported per-image layout fields before calling World Labs', async () => {
    const generate = vi.fn();
    await expect(generateLocationWorld(
      {
        homeDir,
        document: {
          ...document,
          source: {
            kind: 'multiImage',
            images: multiImages.map((image, index) => index === 0
              ? { ...image, layoutHint: 0 }
              : image),
          },
        } as LocationWorldGenerationDocument,
      },
      { generate }
    )).rejects.toMatchObject({ code: 'LOCATION_WORLD_INPUT_INVALID' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects an unsupported source kind before calling World Labs', async () => {
    const generate = vi.fn();
    await expect(generateLocationWorld(
      {
        homeDir,
        document: {
          ...document,
          source: {
            kind: 'ordinaryImage',
            projectRelativePath: 'tmp/media/location-world/image.png',
          },
        } as unknown as LocationWorldGenerationDocument,
      },
      { generate }
    )).rejects.toMatchObject({ code: 'LOCATION_WORLD_INPUT_INVALID' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('retains prior candidates and rolls back through common Asset selection', async () => {
    const projectData = createProjectDataService();
    const generate = vi.fn(async () => generatedWorld('durable spz'));
    const first = await generateLocationWorld(
      { homeDir, document },
      { generate, now: () => '2026-08-18T08:00:00.000Z' }
    );
    const second = await generateLocationWorld(
      { homeDir, document },
      { generate, now: () => '2026-08-18T08:01:00.000Z' }
    );

    const page = await projectData.listAssetPage({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: locationId },
      type: 'location_world',
    });
    expect(page.items.map((asset) => asset.id)).toEqual([
      second.asset.id,
      first.asset.id,
    ]);
    expect(page.selectedAssetId).toBe(second.asset.id);

    await projectData.selectAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'locationWorld', id: locationId },
      assetId: first.asset.id,
    });
    const resource = await projectData.readLocationWorldResource({
      projectName: 'constantinople',
      homeDir,
      locationId,
    });
    expect(resource.selectedWorld?.id).toBe(first.asset.id);
  });

  it('leaves no candidate or selection when World Labs fails', async () => {
    const projectData = createProjectDataService();
    await expect(generateLocationWorld(
      { homeDir, document },
      { generate: async () => { throw new Error('provider unavailable'); } }
    )).rejects.toMatchObject({ code: 'LOCATION_WORLD_GENERATION_FAILED' });

    const page = await projectData.listAssetPage({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: locationId },
      type: 'location_world',
    });
    expect(page.items).toEqual([]);
    expect(page.selectedAssetId).toBeNull();
  });
});

function generatedWorld(contents: string) {
  return {
    operationId: 'operation_1',
    worldId: 'world_1',
    body: new Response(new TextEncoder().encode(contents)).body!,
    contentLength: contents.length,
    mediaKind: 'model' as const,
    mimeType: 'application/octet-stream' as const,
    extension: 'spz' as const,
  };
}
