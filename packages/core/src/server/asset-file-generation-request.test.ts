import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { assetFiles } from './schema/index.js';
import { openProjectSession } from './database/lifecycle/active-session.js';
import { createProjectDataService } from './project-data-service.js';
import {
  createSampleMovieProject,
  writeConfig,
} from './testing/project-data-fixtures.js';
import { readAssetFileGenerationRequest } from './asset-file-generation-request.js';

describe('AssetFile generation request inspection', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-request-inspection-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('rejects missing provenance and an AssetFile from a different Asset', async () => {
    const { projectData, source } = await createExternalSource(homeDir, 'first');
    const second = (await createExternalSource(homeDir, 'second')).source;

    await expect(readAssetFileGenerationRequest({
      projectName: 'constantinople',
      homeDir,
      assetId: source.assetId,
      assetFileId: source.assetFileId,
    })).rejects.toMatchObject({
      code: 'CORE_ASSET_FILE_GENERATION_REQUEST_PROVENANCE_MISSING',
    });
    await expect(readAssetFileGenerationRequest({
      projectName: 'constantinople',
      homeDir,
      assetId: source.assetId,
      assetFileId: second.assetFileId,
    })).rejects.toMatchObject({
      code: 'CORE_ASSET_FILE_GENERATION_REQUEST_SOURCE_INVALID',
    });
    expect(projectData).toBeDefined();
  });

  it('rejects mutable external provenance and discarded source files', async () => {
    const { projectData, source } = await createExternalSource(homeDir, 'mutable');
    const spec = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        executionKind: 'agent-external',
        purpose: 'cast.character-sheet',
        target: { kind: 'castMember', id: 'cast_test0001' },
        model: { provider: 'codex', model: 'gpt-image-2' },
        values: { prompt: 'Exact mutable external request.' },
        references: [],
      },
    });
    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    session.db.update(assetFiles).set({
      sourceGenerationSpecId: spec.id,
    }).where(eq(assetFiles.id, source.assetFileId)).run();

    await expect(readAssetFileGenerationRequest({
      projectName: 'constantinople',
      homeDir,
      assetId: source.assetId,
      assetFileId: source.assetFileId,
    })).rejects.toMatchObject({
      code: 'CORE_ASSET_FILE_GENERATION_REQUEST_SOURCE_SPEC_MUTABLE',
    });

    session.db.update(assetFiles).set({
      discardedAt: '2026-07-19T10:00:00.000Z',
    }).where(eq(assetFiles.id, source.assetFileId)).run();
    await expect(readAssetFileGenerationRequest({
      projectName: 'constantinople',
      homeDir,
      assetId: source.assetId,
      assetFileId: source.assetFileId,
    })).rejects.toMatchObject({
      code: 'CORE_ASSET_FILE_GENERATION_REQUEST_SOURCE_INVALID',
    });
  });
});

async function createExternalSource(homeDir: string, name: string): Promise<{
  projectData: ReturnType<typeof createProjectDataService>;
  source: { assetId: string; assetFileId: string };
}> {
  const projectData = createProjectDataService();
  const existing = await projectData.readCurrentProject({ homeDir });
  const created = existing ?? await createSampleMovieProject({ projectData, homeDir });
  if (!created) {
    throw new Error('Expected a sample project.');
  }
  const projectFolder = 'projectPath' in created
    ? created.projectPath
    : created.projectFolder;
  await fs.mkdir(path.join(projectFolder, 'tmp'), { recursive: true });
  await fs.writeFile(path.join(projectFolder, 'tmp', `${name}.png`), name);
  const attachment = await projectData.attachGenerationMedia({
    projectName: 'constantinople',
    homeDir,
    purpose: 'cast.character-sheet',
    target: { kind: 'castMember', id: 'cast_test0001' },
    sourceProjectRelativePath: `tmp/${name}.png`,
    title: `${name} source`,
  });
  if (!('files' in attachment.asset)) {
    throw new Error('Expected a Cast-owned Asset.');
  }
  return {
    projectData,
    source: {
      assetId: attachment.asset.assetId,
      assetFileId: attachment.asset.files[0]!.id,
    },
  };
}
