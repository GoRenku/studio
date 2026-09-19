import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { inspectGenerationConfigurationVisualizationCache, storeGenerationConfigurationVisualizationCache } from '../generation-configuration-visualizations/service.js';
import { importPersonalMediaModel, listMediaModels, readMediaModel } from './service.js';

it('invalidates selector templates for effective route changes but keeps optional advice independent', async () => {
  const homeDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'model-cache-')));
  try {
    const route = { provider: 'fal-ai', apiId: 'fixture/unguided', name: 'Unguided image' };
    const added = await importPersonalMediaModel({ homeDir, expectedRevision: null,
      providerIds: [route.provider], route });
    const effective = await listMediaModels({ homeDir });
    const descriptor = { provider: route.provider, model: route.apiId,
      operation: 'text-to-image', inputMode: 'text', routeCatalogSha256: effective.routeCatalogSha256,
      visualizeSkillVersion: '1.0.0', visualizeSkillSha256: 'a'.repeat(64),
      templateContractVersion: 1, templateContractSha256: 'b'.repeat(64) };
    await storeGenerationConfigurationVisualizationCache({ descriptor,
      schemaDocument: JSON.stringify({ type: 'object', properties: { prompt: { type: 'string' } } }),
      template: '<section><!--__RENKU_GENERATION_CONFIGURATION_PAYLOAD__--></section>',
      options: { homeDir } });
    const shown = await readMediaModel({ homeDir, ...route });
    await fs.mkdir(path.dirname(shown.personalGuidePath), { recursive: true });
    await fs.writeFile(shown.personalGuidePath, 'Personal advice, with no required sections.');
    expect((await listMediaModels({ homeDir })).routeCatalogSha256).toBe(effective.routeCatalogSha256);
    expect((await inspectGenerationConfigurationVisualizationCache(descriptor, { homeDir })).status).toBe('fresh');
    await fs.unlink(shown.personalGuidePath);
    expect((await inspectGenerationConfigurationVisualizationCache(descriptor, { homeDir })).status).toBe('fresh');
    await importPersonalMediaModel({ homeDir, expectedRevision: added.revision,
      providerIds: [route.provider], route: { ...route, name: 'Renamed image' } });
    const changed = await listMediaModels({ homeDir });
    expect((await inspectGenerationConfigurationVisualizationCache({ ...descriptor,
      routeCatalogSha256: changed.routeCatalogSha256 }, { homeDir })).status).toBe('incompatible');
  } finally {
    await fs.rm(homeDir, { recursive: true, force: true });
  }
});
