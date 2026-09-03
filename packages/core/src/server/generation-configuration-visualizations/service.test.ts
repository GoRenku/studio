import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GENERATION_CONFIGURATION_VISUALIZATION_CACHE_TTL_MS,
  GENERATION_CONFIGURATION_VISUALIZATION_PAYLOAD_PLACEHOLDER,
} from './contracts.js';
import {
  inspectGenerationConfigurationVisualizationCache,
  invalidateGenerationConfigurationVisualizationCache,
  refreshGenerationConfigurationVisualizationCache,
  storeGenerationConfigurationVisualizationCache,
} from './service.js';

const descriptor = {
  provider: 'fal-ai',
  model: 'openai/gpt-image-2',
  operation: 'text-to-image',
  inputMode: 'text',
  routeCatalogSha256: 'a'.repeat(64),
  visualizeSkillVersion: '1.0.27',
  visualizeSkillSha256: 'b'.repeat(64),
  templateContractVersion: 1,
  templateContractSha256: 'c'.repeat(64),
};
const schemaDocument = JSON.stringify({
  type: 'object',
  properties: { quality: { type: 'string', enum: ['low', 'high'] } },
});
const template = `<section id="renku-generation-card">${GENERATION_CONFIGURATION_VISUALIZATION_PAYLOAD_PLACEHOLDER}<script>void 0;</script></section>`;

describe('generation configuration visualization cache', () => {
  it('stores one exact route under the global Renku config and stays fresh for less than 24 hours', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-visualization-cache-'));
    const checkedAt = new Date('2026-09-03T09:00:00.000Z');
    const stored = await storeGenerationConfigurationVisualizationCache({
      descriptor,
      schemaDocument,
      template,
      options: { homeDir, now: () => checkedAt },
    });

    expect(stored).toMatchObject({
      status: 'fresh',
      cacheDirectory: path.join(
        homeDir,
        '.config',
        'renku',
        'cache',
        'generation-configuration-visualizations',
        'v1',
        'routes',
        'fal-ai',
        'openai',
        'gpt-image-2',
        'text-to-image',
        'text'
      ),
      manifest: {
        checkedAt: checkedAt.toISOString(),
        expiresAt: new Date(
          checkedAt.getTime() + GENERATION_CONFIGURATION_VISUALIZATION_CACHE_TTL_MS
        ).toISOString(),
      },
    });
    expect((await fs.stat(stored.manifestPath)).mode & 0o777).toBe(0o600);
    expect((await fs.stat(stored.schemaPath)).mode & 0o777).toBe(0o600);
    expect((await fs.stat(stored.templatePath)).mode & 0o777).toBe(0o600);
    await expect(inspectGenerationConfigurationVisualizationCache(descriptor, {
      homeDir,
      now: () => new Date(checkedAt.getTime() + GENERATION_CONFIGURATION_VISUALIZATION_CACHE_TTL_MS - 1),
    })).resolves.toMatchObject({ status: 'fresh' });
    await expect(inspectGenerationConfigurationVisualizationCache(descriptor, {
      homeDir,
      now: () => new Date(checkedAt.getTime() + GENERATION_CONFIGURATION_VISUALIZATION_CACHE_TTL_MS),
    })).resolves.toMatchObject({ status: 'expired' });
  });

  it('refreshes an expired entry without replacing its template when the schema is semantically unchanged', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-visualization-cache-'));
    await storeGenerationConfigurationVisualizationCache({
      descriptor,
      schemaDocument,
      template,
      options: { homeDir, now: () => new Date('2026-09-01T09:00:00.000Z') },
    });

    const refreshed = await refreshGenerationConfigurationVisualizationCache({
      descriptor,
      schemaDocument: JSON.stringify({
        properties: { quality: { enum: ['low', 'high'], type: 'string' } },
        type: 'object',
      }),
      options: { homeDir, now: () => new Date('2026-09-03T09:00:00.000Z') },
    });

    expect(refreshed).toMatchObject({ status: 'refreshed' });
    expect(await fs.readFile(refreshed.templatePath, 'utf8')).toBe(template);
  });

  it('requires regeneration when the live schema or template dependencies change', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-visualization-cache-'));
    await storeGenerationConfigurationVisualizationCache({
      descriptor,
      schemaDocument,
      template,
      options: { homeDir, now: () => new Date('2026-09-01T09:00:00.000Z') },
    });

    await expect(refreshGenerationConfigurationVisualizationCache({
      descriptor,
      schemaDocument: JSON.stringify({ type: 'object', properties: {} }),
      options: { homeDir, now: () => new Date('2026-09-03T09:00:00.000Z') },
    })).resolves.toMatchObject({ status: 'schema-changed' });
    await expect(inspectGenerationConfigurationVisualizationCache({
      ...descriptor,
      routeCatalogSha256: 'd'.repeat(64),
    }, { homeDir })).resolves.toMatchObject({ status: 'incompatible' });
  });

  it('invalidates without deleting the cached artifacts', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-visualization-cache-'));
    const stored = await storeGenerationConfigurationVisualizationCache({
      descriptor,
      schemaDocument,
      template,
      options: { homeDir },
    });

    await expect(invalidateGenerationConfigurationVisualizationCache(descriptor, {
      homeDir,
    })).resolves.toMatchObject({ status: 'invalidated' });
    await expect(fs.stat(stored.templatePath)).resolves.toHaveProperty('isFile');
    await expect(inspectGenerationConfigurationVisualizationCache(descriptor, {
      homeDir,
    })).resolves.toMatchObject({ status: 'expired' });
  });

  it('reports a corrupt cached schema as invalid so the exact route can be rebuilt', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-visualization-cache-'));
    const stored = await storeGenerationConfigurationVisualizationCache({
      descriptor,
      schemaDocument,
      template,
      options: { homeDir },
    });
    await fs.writeFile(stored.schemaPath, 'not JSON');

    await expect(inspectGenerationConfigurationVisualizationCache(descriptor, {
      homeDir,
    })).resolves.toMatchObject({ status: 'invalid' });
  });

  it('rejects full documents, missing placeholders, and unsafe route segments', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-visualization-cache-'));
    await expect(storeGenerationConfigurationVisualizationCache({
      descriptor,
      schemaDocument,
      template: '<html></html>',
      options: { homeDir },
    })).rejects.toMatchObject({ code: 'GENERATION_CONFIGURATION_VISUALIZATION_CACHE002' });
    await expect(storeGenerationConfigurationVisualizationCache({
      descriptor,
      schemaDocument,
      template: '<section></section>',
      options: { homeDir },
    })).rejects.toMatchObject({ code: 'GENERATION_CONFIGURATION_VISUALIZATION_CACHE002' });
    await expect(inspectGenerationConfigurationVisualizationCache({
      ...descriptor,
      model: '../outside',
    }, { homeDir })).rejects.toMatchObject({
      code: 'GENERATION_CONFIGURATION_VISUALIZATION_CACHE001',
    });
  });

  it('uses a portable encoded folder for an exact pinned model version', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-visualization-cache-'));
    const stored = await storeGenerationConfigurationVisualizationCache({
      descriptor: { ...descriptor, model: 'owner/model:version' },
      schemaDocument,
      template,
      options: { homeDir },
    });

    expect(stored.cacheDirectory).toContain(path.join('owner', 'model%3Aversion'));
  });

  it.skipIf(process.platform === 'win32')('refuses to replace a symlinked cache artifact', async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-visualization-cache-'));
    const stored = await storeGenerationConfigurationVisualizationCache({
      descriptor,
      schemaDocument,
      template,
      options: { homeDir },
    });
    const outsidePath = path.join(homeDir, 'outside.html');
    await fs.writeFile(outsidePath, 'outside');
    await fs.unlink(stored.templatePath);
    await fs.symlink(outsidePath, stored.templatePath);

    await expect(storeGenerationConfigurationVisualizationCache({
      descriptor,
      schemaDocument,
      template,
      options: { homeDir },
    })).rejects.toMatchObject({ code: 'GENERATION_CONFIGURATION_VISUALIZATION_CACHE004' });
    await expect(fs.readFile(outsidePath, 'utf8')).resolves.toBe('outside');
  });
});
