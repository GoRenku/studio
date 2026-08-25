import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { createBlankMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('media generation Preview and Inspection', () => {
  it('projects recursive local references without Asset ids and updates only top-level prompt', async () => {
    const fixture = await createFixture();
    const preview = await fixture.service.readMediaGenerationPreview({
      homeDir: fixture.homeDir,
      projectName: fixture.projectName,
      documentPath: fixture.documentPath,
    });
    expect(preview).toMatchObject({
      kind: 'mediaGenerationPreview',
      documentPath: fixture.documentPath,
      provider: 'codex',
      model: 'gpt-image-2',
      prompt: 'Original prompt',
      editable: true,
      references: [{ kind: 'image', projectRelativePath: 'media/reference.png', available: true }],
      configuration: { nested: [{ nestedPrompt: 'unchanged' }] },
    });
    expect(JSON.stringify(preview)).not.toContain('asset_reference');
    const updated = await fixture.service.updateMediaGenerationPreviewPrompt({
      homeDir: fixture.homeDir,
      projectName: fixture.projectName,
      documentPath: fixture.documentPath,
      prompt: 'Updated prompt',
    });
    expect(updated.prompt).toBe('Updated prompt');
    expect(JSON.parse(await fs.readFile(path.join(fixture.projectFolder, fixture.documentPath), 'utf8'))).toEqual({
      provider: 'codex',
      model: 'gpt-image-2',
      mediaKind: 'image',
      prompt: 'Updated prompt',
      request: {
        prompt: 'provider prompt remains unchanged',
        image: { $file: 'media/reference.png', mimeType: 'image/png' },
        nested: [{ nestedPrompt: 'unchanged' }],
      },
    });
  });

  it('projects saved Asset provenance as a read-only request without a document path', async () => {
    const fixture = await createFixture();
    const preview = await fixture.service.readAssetMediaGenerationRequest({
      homeDir: fixture.homeDir,
      projectName: fixture.projectName,
      assetId: 'asset_generated',
    });
    expect(preview).toMatchObject({ provider: 'codex', model: 'gpt-image-2', editable: false });
    expect(preview.documentPath).toBeUndefined();
  });

  it.each(['../request.json', '/tmp/request.json', 'media/request.json'])(
    'rejects review files outside the operation folder: %s',
    async (documentPath) => {
      const fixture = await createFixture();
      await expect(fixture.service.readMediaGenerationPreview({ homeDir: fixture.homeDir, projectName: fixture.projectName, documentPath })).rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_REVIEW_PATH_INVALID' });
    },
  );
});

async function createFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-media-preview-'));
  temporaryRoots.push(root);
  const homeDir = path.join(root, 'home');
  const storageRoot = path.join(root, 'movies');
  const projectName = 'preview-movie';
  await fs.mkdir(homeDir, { recursive: true });
  await writeConfig(homeDir, storageRoot);
  const service = createProjectDataService();
  await createBlankMovieProject({ homeDir, projectData: service, projectName, title: 'Preview Movie' });
  const projectFolder = path.join(storageRoot, projectName);
  const now = '2026-08-24T00:00:00.000Z';
  const generationProvenance = {
    provider: 'codex',
    model: 'gpt-image-2',
    mediaKind: 'image' as const,
    prompt: 'Original prompt',
    request: { prompt: 'provider prompt remains unchanged', image: { $file: 'media/reference.png', mimeType: 'image/png' }, nested: [{ nestedPrompt: 'unchanged' }] },
  };
  const session = openProjectStore({ projectFolder, create: false });
  try {
    insertAssetRecord(session, { id: 'asset_reference', type: 'reference', mediaKind: 'image', title: 'Reference', origin: 'external', availability: 'ready', createdAt: now, updatedAt: now });
    insertAssetFileRecord(session, { id: 'asset_file_reference', assetId: 'asset_reference', role: 'primary', projectRelativePath: 'media/reference.png', mimeType: 'image/png', mediaKind: 'image', createdAt: now, updatedAt: now });
    insertAssetRecord(session, { id: 'asset_generated', type: 'cast_profile', mediaKind: 'image', title: 'Generated', origin: 'generated', availability: 'ready', generationProvenance, createdAt: now, updatedAt: now });
  } finally {
    session.close();
  }
  await fs.mkdir(path.join(projectFolder, 'media'), { recursive: true });
  await fs.writeFile(path.join(projectFolder, 'media/reference.png'), 'pixels');
  const documentPath = 'tmp/operations/media-generation/request.json';
  await fs.mkdir(path.join(projectFolder, path.dirname(documentPath)), { recursive: true });
  await fs.writeFile(path.join(projectFolder, documentPath), `${JSON.stringify({ ...generationProvenance }, null, 2)}\n`);
  return { service, homeDir, projectName, projectFolder, documentPath };
}
