import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { prepareGenerationConfigurationVisualization } from './preparation.js';
import { storeGenerationConfigurationVisualizationCache } from './service.js';
import { listMediaModels, importPersonalMediaModel } from '../media-model-library/service.js';
import { materializeGenerationConfigurationVisualization } from './materialization.js';

const descriptor = {
  provider: 'atlas', model: 'any-route', operation: 'reference-to-video', inputMode: 'reference',
  visualizeSkillVersion: '1', visualizeSkillSha256: 'b'.repeat(64),
  templateContractVersion: 1, templateContractSha256: 'c'.repeat(64),
};
const template = '<section><!--__RENKU_GENERATION_CONFIGURATION_PAYLOAD__--></section>';
const now = new Date('2026-09-29T10:00:00Z');

async function fixture() {
  const homeDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'renku-preparation-')));
  const options = { homeDir, now: () => now };
  const stored = await storeGenerationConfigurationVisualizationCache({
    descriptor: { ...descriptor, routeCatalogSha256: (await listMediaModels({ homeDir })).routeCatalogSha256 }, template, schemaDocument: '{"type":"object"}', options,
  });
  return { options, stored, outputPath: path.join(homeDir, 'thread-one', 'configuration.html') };
}

describe('cached visualization preparation', () => {
  it('resolves current bundled and personal selectors and invalidates cached HTML when they change', async () => {
    const { options, outputPath } = await fixture();
    const index = path.join(options.homeDir, 'routes.json');
    await fs.writeFile(index, JSON.stringify({ provider: 'atlas', routes: [{ apiId: 'new-route', name: 'New route' }] }));
    await importPersonalMediaModel({ homeDir: options.homeDir, expectedRevision: null,
      providerIds: ['atlas'], route: { provider: 'atlas', apiId: 'personal', name: 'Personal route' } });
    const input = { descriptor, bundledRouteIndexPaths: [index], payload: {}, outputPath, options };
    const result = await prepareGenerationConfigurationVisualization(input);
    expect(result.status).toBe('incompatible');
    expect('routes' in result && result.routes?.map((route) => route.apiId)).toEqual(['new-route', 'personal']);
    await storeGenerationConfigurationVisualizationCache({ descriptor: result.descriptor, template,
      schemaDocument: '{"type":"object"}', options });
    const fresh = await prepareGenerationConfigurationVisualization(input);
    expect(fresh.status).toBe('fresh');
    expect(fresh).not.toHaveProperty('routes');
    expect(fresh.descriptor.routeCatalogSha256).toBe(result.descriptor.routeCatalogSha256);
  });
  it('reuses shared HTML across task directories while isolating and escaping opaque payloads', async () => {
    const { options, stored, outputPath } = await fixture();
    const payload = { prompt: '</script><script>alert(1)</script> $& $`', references: [{ $file: 'first.png' }] };
    const manifest = await fs.readFile(stored.manifestPath, 'utf8');
    const first = await prepareGenerationConfigurationVisualization({ bundledRouteIndexPaths: [], descriptor, payload, outputPath, options });
    expect(first).toMatchObject({ status: 'fresh', outputPath });
    const html = await fs.readFile(outputPath, 'utf8');
    expect(html).not.toContain('</script><script>alert');
    expect(JSON.parse(html.match(/type="application\/json">([^<]*)<\/script>/)![1]!)).toEqual(payload);
    const secondPath = path.join(options.homeDir, 'thread-two', 'configuration.html');
    await prepareGenerationConfigurationVisualization({ bundledRouteIndexPaths: [], descriptor, payload: { prompt: 'Different' }, outputPath: secondPath, options });
    expect(await fs.readFile(secondPath, 'utf8')).not.toContain('alert');
    expect(await fs.readFile(outputPath, 'utf8')).toBe(html);
    expect(await fs.readFile(stored.templatePath, 'utf8')).toBe(template);
    expect(await fs.readFile(stored.manifestPath, 'utf8')).toBe(manifest);
  });

  it.each(['miss', 'expired', 'incompatible', 'invalid'])('returns %s without writing an instance', async (status) => {
    const { options, stored, outputPath } = await fixture();
    const selected = { ...descriptor };
    if (status === 'miss') {
      selected.model = 'another-route';
    }
    if (status === 'incompatible') {
      selected.templateContractSha256 = 'd'.repeat(64);
    }
    if (status === 'expired') {
      options.now = () => new Date(now.getTime() + 86_400_000);
    }
    if (status === 'invalid') {
      await fs.writeFile(stored.templatePath, 'incomplete');
    }
    expect(await prepareGenerationConfigurationVisualization({ bundledRouteIndexPaths: [], descriptor: selected, payload: {}, outputPath, options }))
      .toMatchObject({ status });
    await expect(fs.stat(outputPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects request payloads in shared cache paths, including directory aliases', async () => {
    const { options, stored } = await fixture();
    const alias = path.join(options.homeDir, 'alias');
    await fs.symlink(stored.cacheDirectory, alias);
    for (const outputPath of [stored.templatePath, path.join(alias, 'instance.html')]) {
      await expect(prepareGenerationConfigurationVisualization({ bundledRouteIndexPaths: [], descriptor, payload: {}, outputPath, options }))
        .rejects.toMatchObject({ code: 'GENERATION_CONFIGURATION_VISUALIZATION_CACHE004' });
    }
    expect(await fs.readFile(stored.templatePath, 'utf8')).toBe(template);
  });

  it('rejects invalid fragments, payload envelopes, and oversized instances', () => {
    expect(() => materializeGenerationConfigurationVisualization('<section/>', {})).toThrow();
    expect(() => materializeGenerationConfigurationVisualization(template, [])).toThrow();
    expect(() => materializeGenerationConfigurationVisualization(template, { prompt: 'x'.repeat(1_000_000) })).toThrow();
  });
});
