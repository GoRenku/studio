import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  GENERATION_CONFIGURATION_VISUALIZATION_PAYLOAD_PLACEHOLDER,
} from '@gorenku/studio-core/server';
import {
  inspectGenerationConfigurationVisualization,
  invalidateGenerationConfigurationVisualization,
  storeGenerationConfigurationVisualization,
} from './configuration-visualization.js';

describe('generation configuration visualization CLI', () => {
  it('stores, inspects, and invalidates one system-wide cache entry', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-visualization-cli-'));
    const descriptorPath = path.join(directory, 'descriptor.json');
    const schemaPath = path.join(directory, 'schema.json');
    const templatePath = path.join(directory, 'template.html');
    await fs.writeFile(descriptorPath, JSON.stringify({
      provider: 'fal-ai',
      model: 'openai/gpt-image-2',
      operation: 'text-to-image',
      inputMode: 'text',
      routeCatalogSha256: 'a'.repeat(64),
      visualizeSkillVersion: '1.0.27',
      visualizeSkillSha256: 'b'.repeat(64),
      templateContractVersion: 1,
      templateContractSha256: 'c'.repeat(64),
    }));
    await fs.writeFile(schemaPath, JSON.stringify({ type: 'object', properties: {} }));
    await fs.writeFile(
      templatePath,
      `<section>${GENERATION_CONFIGURATION_VISUALIZATION_PAYLOAD_PLACEHOLDER}</section>`
    );
    const runtime = {
      homeDir: directory,
      json: true,
      io: { stdout: { log: vi.fn() }, stderr: { error: vi.fn() } },
      projectDataService: {},
    };

    await expect(storeGenerationConfigurationVisualization({
      flags: { file: descriptorPath, schema: schemaPath, template: templatePath },
      runtime,
    } as never)).resolves.toMatchObject({ status: 'fresh' });
    await expect(inspectGenerationConfigurationVisualization({
      flags: { file: descriptorPath },
      runtime,
    } as never)).resolves.toMatchObject({ status: 'fresh' });
    await expect(invalidateGenerationConfigurationVisualization({
      flags: { file: descriptorPath },
      runtime,
    } as never)).resolves.toMatchObject({ status: 'invalidated' });
    await expect(inspectGenerationConfigurationVisualization({
      flags: { file: descriptorPath },
      runtime,
    } as never)).resolves.toMatchObject({ status: 'expired' });
  });
});
