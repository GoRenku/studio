import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../index.js';
import {
  runCreateOrSkip,
  writeConfig,
  writeNarrativeProjectSetup,
} from '../testing/project-data-fixtures.js';

describe('markdown asset content resource', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-markdown-asset-content-resource-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('reads and updates Markdown asset content by asset link', async () => {
    const setupPath = await writeNarrativeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const project = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    const clip = project.sequences[0]?.scenes[0]?.clips[0];
    const summaryAsset = clip?.summaryAsset;
    expect(summaryAsset).toBeDefined();
    if (!summaryAsset) {
      return;
    }

    await expect(
      projectData.readMarkdownAssetContent({
        projectName: 'constantinople',
        homeDir,
        assetId: summaryAsset.assetId,
        assetFileId: summaryAsset.assetFileId,
      })
    ).resolves.toMatchObject({
      assetId: summaryAsset.assetId,
      assetFileId: summaryAsset.assetFileId,
      projectRelativePath: summaryAsset.projectRelativePath,
      content: 'Clip summary from Markdown.\n',
    });

    const preservedMarkdown = '    npm test\n\nKeep this line.  \n\n';
    const updated = await projectData.updateMarkdownAssetContent({
      projectName: 'constantinople',
      homeDir,
      assetId: summaryAsset.assetId,
      assetFileId: summaryAsset.assetFileId,
      content: preservedMarkdown,
    });

    expect(updated.content).toMatchObject({
      assetId: summaryAsset.assetId,
      assetFileId: summaryAsset.assetFileId,
      projectRelativePath: summaryAsset.projectRelativePath,
      content: preservedMarkdown,
    });
    expect(updated.resourceKeys).toEqual([
      `markdown:${summaryAsset.assetId}:${summaryAsset.assetFileId}`,
      `assets:clip:${clip.id}`,
      `surface:clip-design:${clip.id}`,
    ]);
    await expect(
      fs.readFile(
        path.join(created.projectPath, summaryAsset.projectRelativePath),
        'utf8'
      )
    ).resolves.toBe(preservedMarkdown);
  });
});
