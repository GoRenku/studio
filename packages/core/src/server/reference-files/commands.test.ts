import fs from 'node:fs/promises';
import { renameSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectDataService } from '../project-data-service.js';
import { createBlankMovieProject, writeConfig } from '../testing/project-data-fixtures.js';
import { closeProjectStore, openProjectStore } from '../database/lifecycle/store.js';
import { projects } from '../schema/project.js';
import { trashItems } from '../schema/trash.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, renameSync: vi.fn(actual.renameSync) };
});

describe('retained reference files', () => {
  const service = createProjectDataService();
  let homeDir: string;
  let projectFolder: string;
  const projectName = 'blank-movie';
  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-reference-files-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    const created = await createBlankMovieProject({ homeDir, projectData: service });
    projectFolder = created!.projectPath;
  });
  afterEach(async () => { closeProjectStore({ projectFolder }); await fs.rm(homeDir, { recursive: true, force: true }); });
  const input = () => ({ projectName, homeDir });
  async function source(relativePath: string, contents = 'opaque bytes') {
    await fs.mkdir(path.dirname(path.join(projectFolder, relativePath)), { recursive: true });
    await fs.writeFile(path.join(projectFolder, relativePath), contents);
  }
  async function folder() {
    return (await service.createInspirationFolder({ ...input(), name: 'Reference room' })).folder;
  }

  it('copies colliding sources without overwrites and retains quiet metadata', async () => {
    const inspiration = await folder();
    await source('tmp/first/reference.png', 'first');
    await source('tmp/second/reference.png', 'second');
    const report = await service.importReferenceFiles({ ...input(), destination: { kind: 'inspiration', folderId: inspiration.id },
      files: [{ sourceProjectRelativePath: 'tmp/first/reference.png' }, { sourceProjectRelativePath: 'tmp/second/reference.png', title: 'Second angle' }] });
    expect(new Set(report.assetFiles.map((file) => file.projectRelativePath)).size).toBe(2);
    expect(report.assetFiles.map((file) => file.title)).toEqual([null, 'Second angle']);
    expect(await fs.readFile(path.join(projectFolder, report.assetFiles[0]!.projectRelativePath), 'utf8')).toBe('first');
    expect(await fs.readFile(path.join(projectFolder, report.assetFiles[1]!.projectRelativePath), 'utf8')).toBe('second');
    expect((await service.readInspirationFolder({ ...input(), folderId: inspiration.id })).images).toHaveLength(2);
  });

  it('adopts unchanged in-place research once and rejects changed bytes', async () => {
    await source('research/notes/opaque.bin');
    const request = { ...input(), destination: { kind: 'research' as const }, files: [{ sourceProjectRelativePath: 'research/notes/opaque.bin' }] };
    const first = await service.importReferenceFiles(request);
    expect((await service.importReferenceFiles(request)).assetFiles).toEqual(first.assetFiles);
    await source('research/notes/opaque.bin', 'changed');
    await expect(service.importReferenceFiles(request)).rejects.toMatchObject({ code: 'CORE_REFERENCE_FILE_CONFLICT' });
    expect(await service.listAssetFiles({ ...input(), owner: { kind: 'project' }, type: 'research_reference' })).toHaveLength(1);
  });

  it('allocates a new upload path when Empty Trash has collected the original filename', async () => {
    const inspiration = await folder();
    const upload = { ...input(), folderId: inspiration.id, fileName: 'frame.png', contents: Buffer.from('original') };
    const original = (await service.writeInspirationImage(upload)).resource.images[0]!;
    await service.deleteInspirationImage({ ...input(), folderId: inspiration.id, assetFileId: original.id });
    const preview = await service.previewGarbageCollection(input());
    await service.emptyTrash({ ...input(), confirmationToken: preview.confirmationToken });
    const replacement = (await service.writeInspirationImage({ ...upload, contents: Buffer.from('new image') })).resource.images[0]!;
    expect(replacement.id).not.toBe(original.id);
    expect(replacement.projectRelativePath).toBe(`${inspiration.projectRelativePath}/frame-2.png`);
    expect(await fs.readFile(path.join(projectFolder, replacement.projectRelativePath), 'utf8')).toBe('new image');
    await expect(service.resolveProjectAssetFileById({ ...input(), assetFileId: original.id }))
      .rejects.toMatchObject({ code: 'CORE_PROJECT_ASSET_FILE_DISCARDED' });
  });

  it('rolls back copied files when a later adopted file conflicts', async () => {
    await source('research/conflict.bin');
    const first = await service.importReferenceFiles({ ...input(), destination: { kind: 'research' }, files: [{ sourceProjectRelativePath: 'research/conflict.bin' }] });
    await service.discardAssetFile({ ...input(), owner: { kind: 'project' }, assetFileId: first.assetFiles[0]!.id });
    await source('tmp/new.bin', 'new');
    await expect(service.importReferenceFiles({ ...input(), destination: { kind: 'research' }, files: [
      { sourceProjectRelativePath: 'tmp/new.bin' }, { sourceProjectRelativePath: 'research/conflict.bin' },
    ] })).rejects.toMatchObject({ code: 'CORE_REFERENCE_FILE_CONFLICT' });
    expect(await fs.readdir(path.join(projectFolder, 'research'))).toEqual(['conflict.bin']);
    expect(await fs.readFile(path.join(projectFolder, 'tmp/new.bin'), 'utf8')).toBe('new');
  });

  it('reports all bad paths before copying anything', async () => {
    await source('tmp/valid.bin');
    await expect(service.importReferenceFiles({ ...input(), destination: { kind: 'research' }, files: [
      { sourceProjectRelativePath: 'tmp/valid.bin' }, { sourceProjectRelativePath: '../outside' }, { sourceProjectRelativePath: 'tmp/missing' },
    ] })).rejects.toMatchObject({ code: 'CORE_REFERENCE_FILE_SOURCE_INVALID', issues: expect.arrayContaining([
      expect.objectContaining({ location: expect.objectContaining({ path: ['files', '1', 'sourceProjectRelativePath'] }) }),
      expect.objectContaining({ location: expect.objectContaining({ path: ['files', '2', 'sourceProjectRelativePath'] }) }),
    ]) });
    expect(await service.listAssetFiles({ ...input(), owner: { kind: 'project' }, type: 'research_reference' })).toEqual([]);
  });

  it('rejects symlink sources, including links inside the Project', async () => {
    await source('tmp/original.png');
    await fs.symlink('original.png', path.join(projectFolder, 'tmp/link.png'));
    await expect(service.importReferenceFiles({ ...input(), destination: { kind: 'research' }, files: [{ sourceProjectRelativePath: 'tmp/link.png' }] }))
      .rejects.toMatchObject({ code: 'CORE_REFERENCE_FILE_SOURCE_INVALID' });
  });

  it('renames active and individually discarded files without changing their identities', async () => {
    const inspiration = await folder();
    await source('tmp/reference.png');
    const first = await service.importReferenceFiles({ ...input(), destination: { kind: 'inspiration', folderId: inspiration.id }, files: [{ sourceProjectRelativePath: 'tmp/reference.png' }] });
    const image = first.assetFiles[0]!;
    const discarded = await service.deleteInspirationImage({ ...input(), folderId: inspiration.id, assetFileId: image.id });
    const renamed = await service.renameInspirationFolder({ ...input(), folderId: inspiration.id, name: 'New room' });
    await service.restoreTrashItem({ ...input(), trashItemId: discarded.recovery!.trashItemIds[0]! });
    const images = (await service.readInspirationFolder({ ...input(), folderId: inspiration.id })).images;
    expect(images[0]).toMatchObject({ id: image.id, contentHash: image.contentHash, owner: image.owner,
      projectRelativePath: `${renamed.folder.projectRelativePath}/reference.png` });
  });

  it('preserves collected Trash history when its populated folder is renamed', async () => {
    const inspiration = await folder();
    await source('tmp/reference.png');
    const imported = await service.importReferenceFiles({ ...input(), destination: { kind: 'inspiration', folderId: inspiration.id },
      files: [{ sourceProjectRelativePath: 'tmp/reference.png' }] });
    await service.deleteInspirationImage({ ...input(), folderId: inspiration.id, assetFileId: imported.assetFiles[0]!.id });
    const preview = await service.previewGarbageCollection(input());
    await service.emptyTrash({ ...input(), confirmationToken: preview.confirmationToken });
    const before = openProjectStore({ projectFolder, create: false });
    const history = before.db.select().from(trashItems).all();
    before.close();
    await source('tmp/active.png');
    await service.importReferenceFiles({ ...input(), destination: { kind: 'inspiration', folderId: inspiration.id },
      files: [{ sourceProjectRelativePath: 'tmp/active.png' }] });
    await service.renameInspirationFolder({ ...input(), folderId: inspiration.id, name: 'New room' });
    const after = openProjectStore({ projectFolder, create: false });
    expect(after.db.select().from(trashItems).all()).toEqual(history);
    after.close();
    expect((await service.readInspirationFolder({ ...input(), folderId: inspiration.id })).images).toHaveLength(1);
  });

  it('clears nullable titles and rejects non-text metadata before a write', async () => {
    await source('research/reference.bin');
    const imported = await service.importReferenceFiles({ ...input(), destination: { kind: 'research' },
      files: [{ sourceProjectRelativePath: 'research/reference.bin', title: 'Original' }] });
    const assetFileId = imported.assetFiles[0]!.id;
    expect((await service.updateAssetFile({ ...input(), assetFileId, title: null })).assetFile.title).toBeNull();
    await expect(service.updateAssetFile({ ...input(), assetFileId, title: 42 as unknown as string }))
      .rejects.toMatchObject({ code: 'CORE_ASSET_FILE_METADATA_INVALID' });
    expect((await service.listAssetFiles({ ...input(), owner: { kind: 'project' }, type: 'research_reference' }))[0]!.title).toBeNull();
  });

  it('backfills only pending reference trees and remains read-only after completion', async () => {
    const inspiration = await folder();
    await source(`${inspiration.projectRelativePath}/first.png`);
    await source('research/nested/notes.bin');
    const session = openProjectStore({ projectFolder, create: false });
    session.db.update(projects).set({ assetFileBackfillVersion: 0 }).where(eq(projects.projectName, projectName)).run();
    session.close();
    closeProjectStore({ projectFolder });
    expect((await service.readInspirationFolder({ ...input(), folderId: inspiration.id })).images).toHaveLength(1);
    expect(await service.listAssetFiles({ ...input(), owner: { kind: 'project' }, type: 'research_reference' })).toHaveLength(1);
    await source(`${inspiration.projectRelativePath}/unregistered.png`);
    closeProjectStore({ projectFolder });
    expect((await service.readInspirationFolder({ ...input(), folderId: inspiration.id })).images).toHaveLength(1);
  });

  it('keeps a failed pending backfill atomic and retries after the cause is repaired', async () => {
    const inspiration = await folder();
    await source('research/valid.png');
    await fs.rmdir(path.join(projectFolder, inspiration.projectRelativePath));
    const session = openProjectStore({ projectFolder, create: false });
    session.db.update(projects).set({ assetFileBackfillVersion: 0 }).run();
    session.close();
    closeProjectStore({ projectFolder });
    expect(() => openProjectStore({ projectFolder, create: false, lifetime: 'project' }))
      .toThrow(expect.objectContaining({ code: 'PROJECT_ASSET_FILE_BACKFILL_FAILED' }));
    await fs.mkdir(path.join(projectFolder, inspiration.projectRelativePath));
    const retried = openProjectStore({ projectFolder, create: false, lifetime: 'project' });
    expect(retried.db.select().from(projects).get()?.assetFileBackfillVersion).toBe(1);
    expect(await service.listAssetFiles({ ...input(), owner: { kind: 'project' }, type: 'research_reference' }))
      .toHaveLength(1);
    expect(openProjectStore({ projectFolder, create: false, lifetime: 'project' })).toBe(retried);
  });

  it.each([
    ['image.webp', 'image', 'image/webp'], ['audio.ogg', 'audio', 'audio/ogg'],
    ['video.webm', 'video', 'video/webm'], ['document.bin', 'file', 'application/octet-stream'],
  ])('registers research %s with its physical kind and MIME type', async (name, mediaKind, mimeType) => {
    await source(`research/${name}`);
    const imported = await service.importReferenceFiles({ ...input(), destination: { kind: 'research' },
      files: [{ sourceProjectRelativePath: `research/${name}` }] });
    expect(imported.assetFiles[0]).toMatchObject({ mediaKind, mimeType });
    const resolved = await service.resolveProjectAssetFileById({ ...input(), assetFileId: imported.assetFiles[0]!.id });
    expect(await fs.readFile(resolved.absolutePath, 'utf8')).toBe('opaque bytes');
  });


  it('rolls back the directory and every stored path when rename metadata fails', async () => {
    const inspiration = await folder();
    await source('tmp/reference.png');
    const imported = await service.importReferenceFiles({ ...input(), destination: { kind: 'inspiration', folderId: inspiration.id },
      files: [{ sourceProjectRelativePath: 'tmp/reference.png' }] });
    const session = openProjectStore({ projectFolder, create: false });
    session.db.run(sql.raw("CREATE TRIGGER fail_folder_rename BEFORE UPDATE ON inspiration_folder BEGIN SELECT RAISE(ABORT, 'injected metadata failure'); END"));
    session.close();
    await expect(service.renameInspirationFolder({ ...input(), folderId: inspiration.id, name: 'New room' }))
      .rejects.toMatchObject({ code: 'CORE_INSPIRATION_FOLDER_RENAME_FAILED' });
    const resource = await service.readInspirationFolder({ ...input(), folderId: inspiration.id });
    expect(resource.folder).toEqual(inspiration);
    expect(resource.images[0]).toEqual(imported.assetFiles[0]);
    expect(await fs.readFile(path.join(projectFolder, imported.assetFiles[0]!.projectRelativePath), 'utf8')).toBe('opaque bytes');
  });

  it('rejects a non-directory Inspiration path before moving or mutating metadata', async () => {
    const inspiration = await folder();
    await fs.rmdir(path.join(projectFolder, inspiration.projectRelativePath));
    await source(inspiration.projectRelativePath, 'not a directory');
    await expect(service.renameInspirationFolder({ ...input(), folderId: inspiration.id, name: 'New room' }))
      .rejects.toMatchObject({ code: 'CORE_INSPIRATION_FOLDER_PATH_INVALID' });
    expect(await fs.readFile(path.join(projectFolder, inspiration.projectRelativePath), 'utf8')).toBe('not a directory');
  });

  it('reports the exact directory location when a failed rename cannot be rolled back', async () => {
    const inspiration = await folder();
    const session = openProjectStore({ projectFolder, create: false });
    session.db.run(sql.raw("CREATE TRIGGER fail_folder_rename BEFORE UPDATE ON inspiration_folder BEGIN SELECT RAISE(ABORT, 'injected metadata failure'); END"));
    session.close();
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
    vi.mocked(renameSync).mockImplementationOnce(actual.renameSync).mockImplementationOnce(() => {
      throw new Error('Injected rollback move failure');
    });
    await expect(service.renameInspirationFolder({ ...input(), folderId: inspiration.id, name: 'New room' }))
      .rejects.toMatchObject({ code: 'CORE_INSPIRATION_FOLDER_RENAME_ROLLBACK_FAILED',
        issues: [expect.objectContaining({ location: expect.objectContaining({ path: ['folderId'] }) })],
        suggestion: expect.stringContaining(inspiration.projectRelativePath) });
    const resource = await service.readInspirationFolder({ ...input(), folderId: inspiration.id });
    expect(resource.folder).toEqual(inspiration);
    expect(await fs.readdir(path.dirname(path.join(projectFolder, inspiration.projectRelativePath))))
      .toEqual(['new-room']);
  });


  it('completes concurrent process opens without duplicate retained identities', async () => {
    const inspiration = await folder();
    await source(`${inspiration.projectRelativePath}/reference.png`);
    await source('research/reference.wav');
    const session = openProjectStore({ projectFolder, create: false });
    session.db.update(projects).set({ assetFileBackfillVersion: 0 }).run();
    session.close();
    closeProjectStore({ projectFolder });
    const script = `import { createProjectDataService } from ${JSON.stringify(path.join(process.cwd(), 'dist/server/index.js'))};
      const service = createProjectDataService();
      const files = await service.listAssetFiles(${JSON.stringify({ ...input(), owner: { kind: 'project' }, type: 'research_reference' })});
      process.stdout.write(JSON.stringify(files.map(file => file.id)));`;
    const results = await Promise.all([1, 2].map(() => promisify(execFile)(process.execPath, ['--input-type=module', '-e', script])));
    expect(JSON.parse(results[0]!.stdout)).toEqual(JSON.parse(results[1]!.stdout));
    expect(JSON.parse(results[0]!.stdout)).toHaveLength(1);
    expect((await service.readInspirationFolder({ ...input(), folderId: inspiration.id })).images).toHaveLength(1);
  });


  it('collects retained files and skips the current collected folder during a pending upgrade', async () => {
    const inspiration = await folder();
    await source('tmp/reference.png');
    const imported = await service.importReferenceFiles({ ...input(), destination: { kind: 'inspiration', folderId: inspiration.id },
      files: [{ sourceProjectRelativePath: 'tmp/reference.png' }] });
    const file = imported.assetFiles[0]!;
    await service.deleteInspirationImage({ ...input(), folderId: inspiration.id, assetFileId: file.id });
    const imagePreview = await service.previewGarbageCollection(input());
    expect(imagePreview.files).toHaveLength(1);
    await service.emptyTrash({ ...input(), confirmationToken: imagePreview.confirmationToken });
    await expect(fs.stat(path.join(projectFolder, file.projectRelativePath))).rejects.toMatchObject({ code: 'ENOENT' });
    await service.deleteInspirationFolder({ ...input(), folderId: inspiration.id });
    const folderPreview = await service.previewGarbageCollection(input());
    await service.emptyTrash({ ...input(), confirmationToken: folderPreview.confirmationToken });
    await expect(fs.stat(path.join(projectFolder, inspiration.projectRelativePath))).rejects.toMatchObject({ code: 'ENOENT' });
    const session = openProjectStore({ projectFolder, create: false });
    session.db.update(projects).set({ assetFileBackfillVersion: 0 }).run();
    session.close();
    closeProjectStore({ projectFolder });
    const opened = openProjectStore({ projectFolder, create: false });
    expect(opened.db.select().from(projects).get()?.assetFileBackfillVersion).toBe(1);
    opened.close();
  });

});
