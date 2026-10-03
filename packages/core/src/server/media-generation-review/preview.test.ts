import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { assetFiles } from '../schema/index.js';
import { createBlankMovieProject, writeConfig } from '../testing/project-data-fixtures.js';
import { projectMediaGenerationPreview } from './preview.js';
import { readMediaGenerationReferenceProjectFile } from './local-media.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })));
});

describe('media generation Preview and Inspection', () => {
  it('hashes and parses the same exact bytes even when the file changes after the read', async () => {
    const fixture = await createFixture();
    const file = await fs.realpath(path.join(fixture.projectFolder, fixture.documentPath));
    const original = await fs.readFile(file);
    const readFile = fs.readFile.bind(fs);
    const read = vi.spyOn(fs, 'readFile').mockImplementation(async (...args: Parameters<typeof fs.readFile>) => {
      const bytes = await readFile(...args);
      if (String(args[0]) === file) {
        await fs.writeFile(file, '{}');
      }
      return bytes;
    });
    try {
      const review = await fixture.service.readMediaGenerationReview({
        homeDir: fixture.homeDir, projectName: fixture.projectName, documentPath: fixture.documentPath,
      });
      expect(review.requestSha256).toBe(createHash('sha256').update(original).digest('hex'));
      expect(review.document.prompt).toBe('Original prompt');
      expect(review.projectRef.name).toBe(fixture.projectName);
      expect(review.projectFolder).toBe(fixture.projectFolder);
      expect(read.mock.calls.filter(([readPath]) => String(readPath) === file)).toHaveLength(1);
    } finally {
      read.mockRestore();
    }
  });

  it('rejects a review symlink to bytes outside the Project operation folder', async () => {
    const fixture = await createFixture();
    const outside = path.join(fixture.homeDir, 'private.json');
    await fs.writeFile(outside, '{}');
    const documentPath = 'tmp/operations/media-generation/outside.json';
    await fs.symlink(outside, path.join(fixture.projectFolder, documentPath));
    await expect(fixture.service.readMediaGenerationReview({
      homeDir: fixture.homeDir, projectName: fixture.projectName, documentPath,
    })).rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_REVIEW_PATH_INVALID' });
  });

  it('checks the bound hash before parsing changed request bytes', async () => {
    const fixture = await createFixture();
    const review = await fixture.service.readMediaGenerationReview({
      homeDir: fixture.homeDir, projectName: fixture.projectName, documentPath: fixture.documentPath,
    });
    await fs.writeFile(path.join(fixture.projectFolder, fixture.documentPath), 'invalid JSON');
    await expect(fixture.service.readMediaGenerationReview({
      homeDir: fixture.homeDir, projectName: fixture.projectName, documentPath: fixture.documentPath,
      expectedRequestSha256: review.requestSha256,
    })).rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_REVIEW_CHANGED' });
  });

  it('rechecks reference registration and Project identity when reading reference media', async () => {
    const fixture = await createFixture();
    const project = await fixture.service.resolveStudioProjectRef({ homeDir: fixture.homeDir, projectName: fixture.projectName });
    const input = { homeDir: fixture.homeDir, projectName: fixture.projectName, projectRelativePath: 'media/reference.png', expectedProjectId: project.id };
    await expect(readMediaGenerationReferenceProjectFile(input)).resolves.toMatchObject({ mimeType: 'image/png' });
    await expect(readMediaGenerationReferenceProjectFile({ ...input, expectedProjectId: 'other-project' })).rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND' });
    await expect(readMediaGenerationReferenceProjectFile({ ...input, projectRelativePath: 'media/undeclared.png' })).rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND' });
  });

  it('rejects registered reference media that resolves outside its Project', async () => {
    const fixture = await createFixture();
    const outside = path.join(fixture.homeDir, 'outside.png');
    await fs.writeFile(outside, 'private bytes');
    const registeredPath = path.join(fixture.projectFolder, 'media/reference.png');
    await fs.rename(registeredPath, `${registeredPath}.saved`);
    await fs.symlink(outside, registeredPath);
    await expect(readMediaGenerationReferenceProjectFile({
      homeDir: fixture.homeDir, projectName: fixture.projectName, projectRelativePath: 'media/reference.png',
    })).rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_OUTSIDE_PROJECT' });
  });

  it('previews and reads active Inspiration images without registering Assets', async () => {
    const fixture = await createInspirationFixture();
    const input = { homeDir: fixture.homeDir, projectName: fixture.projectName };
    const preview = await fixture.service.readMediaGenerationPreview({ ...input, documentPath: fixture.documentPath });
    expect(preview.references).toEqual([expect.objectContaining({
      kind: 'image', available: true, projectRelativePath: fixture.imagePath,
      browserUrl: expect.stringContaining(encodeURIComponent(fixture.imagePath)),
    })]);
    expect(preview.diagnostics).toEqual([]);
    const file = await readMediaGenerationReferenceProjectFile({ ...input, projectRelativePath: fixture.imagePath });
    expect(file.mimeType).toBe('image/jpeg');
    expect(await fs.readFile(file.absolutePath, 'utf8')).toBe('inspiration bytes');
    const session = openProjectStore({ projectFolder: fixture.projectFolder, create: false });
    try {
      expect(session.db.select().from(assetFiles).where(eq(assetFiles.projectRelativePath, fixture.imagePath)).all()).toEqual([]);
    } finally {
      session.close();
    }
  });

  it.each(['image', 'folder'])('rechecks discarded Inspiration %s ownership on preview and read', async (discarded) => {
    const fixture = await createInspirationFixture();
    const input = { homeDir: fixture.homeDir, projectName: fixture.projectName, folderId: fixture.folder.id };
    if (discarded === 'image') {
      await fixture.service.deleteInspirationImage({ ...input, fileName: 'Coco_060.JPG' });
    } else {
      await fixture.service.deleteInspirationFolder(input);
    }
    expect(await fs.readFile(path.join(fixture.projectFolder, fixture.imagePath), 'utf8')).toBe('inspiration bytes');
    const preview = await fixture.service.readMediaGenerationPreview({ ...input, documentPath: fixture.documentPath });
    expect(preview.references[0]).toMatchObject({ available: false });
    expect(preview.references[0]?.browserUrl).toBeUndefined();
    expect(preview.diagnostics).toMatchObject([{ code: 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND' }]);
    await expect(readMediaGenerationReferenceProjectFile({ ...input, projectRelativePath: fixture.imagePath }))
      .rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND' });
  });

  it.each(['missing.jpg', 'notes.txt', 'nested/frame.jpg', '../coco-other/frame.jpg'])(
    'does not expose missing, non-image or unrelated Inspiration files: %s', async (fileName) => {
      const fixture = await createInspirationFixture();
      const projectRelativePath = path.posix.join(fixture.folder.projectRelativePath, fileName);
      if (fileName !== 'missing.jpg') {
        const absolutePath = path.join(fixture.projectFolder, projectRelativePath);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        await fs.writeFile(absolutePath, 'private bytes');
      }
      await writeInspirationRequest(fixture, projectRelativePath);
      const input = { homeDir: fixture.homeDir, projectName: fixture.projectName };
      const preview = await fixture.service.readMediaGenerationPreview({ ...input, documentPath: fixture.documentPath });
      expect(preview.references[0]).toMatchObject({ available: false });
      await expect(readMediaGenerationReferenceProjectFile({ ...input, projectRelativePath }))
        .rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND' });
    },
  );

  it.each(['file', 'folder'])('rejects an Inspiration %s symlink outside the Project during preview and read', async (linked) => {
    const fixture = await createInspirationFixture();
    const original = path.join(fixture.projectFolder, linked === 'file' ? fixture.imagePath : fixture.folder.projectRelativePath);
    const outside = path.join(fixture.homeDir, 'outside');
    await fs.mkdir(outside, { recursive: true });
    await fs.writeFile(path.join(outside, 'Coco_060.JPG'), 'private bytes');
    await fs.rename(original, `${original}.saved`);
    await fs.symlink(linked === 'file' ? path.join(outside, 'Coco_060.JPG') : outside, original);
    const input = { homeDir: fixture.homeDir, projectName: fixture.projectName };
    await expect(fixture.service.readMediaGenerationPreview({ ...input, documentPath: fixture.documentPath }))
      .rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_OUTSIDE_PROJECT' });
    await expect(readMediaGenerationReferenceProjectFile({ ...input, projectRelativePath: fixture.imagePath }))
      .rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_OUTSIDE_PROJECT' });
  });

  it('rejects an Inspiration folder symlink to unrelated files inside the Project', async () => {
    const fixture = await createInspirationFixture();
    const original = path.join(fixture.projectFolder, fixture.folder.projectRelativePath);
    await fs.rename(original, `${original}.saved`);
    await fs.mkdir(path.join(fixture.projectFolder, 'private'));
    await fs.writeFile(path.join(fixture.projectFolder, 'private/Coco_060.JPG'), 'private bytes');
    await fs.symlink(path.join(fixture.projectFolder, 'private'), original);
    const input = { homeDir: fixture.homeDir, projectName: fixture.projectName };
    await expect(fixture.service.readMediaGenerationPreview({ ...input, documentPath: fixture.documentPath }))
      .rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_OUTSIDE_PROJECT' });
    await expect(readMediaGenerationReferenceProjectFile({ ...input, projectRelativePath: fixture.imagePath }))
      .rejects.toMatchObject({ code: 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_OUTSIDE_PROJECT' });
  });

  it('projects the supplied document even when its file has changed', async () => {
    const fixture = await createFixture();
    const file = path.join(fixture.projectFolder, fixture.documentPath);
    const document = JSON.parse(await fs.readFile(file, 'utf8'));
    const original = await fixture.service.readMediaGenerationPreview({
      homeDir: fixture.homeDir, projectName: fixture.projectName, documentPath: fixture.documentPath,
    });
    await fs.writeFile(file, '{}');
    expect(await projectMediaGenerationPreview({
      homeDir: fixture.homeDir, projectName: fixture.projectName, documentPath: fixture.documentPath, document,
    })).toEqual(original);
  });
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
      provider: 'pika',
      model: 'bytedance/seedream-5.0-pro/image-to-image',
      prompt: 'Original prompt',
      editable: true,
      references: [
        {
          requestPointer: '/image',
          kind: 'image',
          projectRelativePath: 'media/reference.png',
          reviewLabel: 'Stone arch reference',
          promptMention: '@Image1',
          available: true,
        },
        {
          requestPointer: '/secondary',
          kind: 'image',
          projectRelativePath: 'media/reference.png',
          reviewLabel: 'Same file in an implicit field',
          available: true,
        },
      ],
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
      provider: 'pika',
      model: 'bytedance/seedream-5.0-pro/image-to-image',
      mediaKind: 'image',
      prompt: 'Updated prompt',
      request: {
        prompt: 'provider prompt remains unchanged',
        image: { $file: 'media/reference.png', mimeType: 'image/png', reviewLabel: 'Stone arch reference', promptMention: '@Image1' },
        secondary: { $file: 'media/reference.png', mimeType: 'image/png', reviewLabel: 'Same file in an implicit field' },
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
    expect(preview).toMatchObject({
      provider: 'pika',
      model: 'bytedance/seedream-5.0-pro/image-to-image',
      editable: false,
    });
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

async function createInspirationFixture() {
  const fixture = await createFixture();
  const { folder } = await fixture.service.createInspirationFolder({
    homeDir: fixture.homeDir, projectName: fixture.projectName, name: 'Coco',
  });
  const imagePath = `${folder.projectRelativePath}/Coco_060.JPG`;
  await fs.writeFile(path.join(fixture.projectFolder, imagePath), 'inspiration bytes');
  await writeInspirationRequest(fixture, imagePath);
  return { ...fixture, folder, imagePath };
}

async function writeInspirationRequest(fixture: { projectFolder: string; documentPath: string }, imagePath: string) {
  await fs.writeFile(path.join(fixture.projectFolder, fixture.documentPath), JSON.stringify({
    provider: 'codex', model: 'chatgpt-images-2.5', mediaKind: 'image', prompt: 'Original prompt',
    request: { image: { $file: imagePath, mimeType: 'image/jpeg', reviewLabel: 'Coco appearance reference' } },
  }));
}

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
    provider: 'pika',
    model: 'bytedance/seedream-5.0-pro/image-to-image',
    mediaKind: 'image' as const,
    prompt: 'Original prompt',
    request: {
      prompt: 'provider prompt remains unchanged',
      image: { $file: 'media/reference.png', mimeType: 'image/png', reviewLabel: 'Stone arch reference', promptMention: '@Image1' },
      secondary: { $file: 'media/reference.png', mimeType: 'image/png', reviewLabel: 'Same file in an implicit field' },
      nested: [{ nestedPrompt: 'unchanged' }],
    },
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
