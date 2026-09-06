import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectDataService } from '../../project-data-service.js';
import { createBlankMovieProject, writeConfig } from '../../testing/project-data-fixtures.js';

describe('Project supporting files', () => {
  const service = createProjectDataService();
  let homeDir: string;
  const projectName = 'file-library';

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-file-library-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    await createBlankMovieProject({ homeDir, projectData: service, projectName, title: 'File Library' });
  });

  async function importNotes(filename: string, contents = filename) {
    const sourcePath = path.join(homeDir, filename);
    await fs.writeFile(sourcePath, contents);
    return service.importScreenplaySupportingMaterial({ projectName, homeDir, sourcePath });
  }

  it('uploads opaque bytes through the existing importer and rejects path filenames', async () => {
    const contents = new TextEncoder().encode('Opaque source notes').buffer;
    const input = { projectName, homeDir, fileName: 'research.md', contents };
    const report = await service.uploadScreenplaySupportingMaterial(input);
    expect(report.status).toBe('imported');
    expect(report.material.title).toBe('research.md');
    const information = await service.resolveProjectSupportingFile({ projectName, homeDir, assetId: report.material.id });
    expect(await fs.readFile(information.absolutePath, 'utf8')).toBe('Opaque source notes');
    expect((await service.uploadScreenplaySupportingMaterial(input)).status).toBe('unchanged');
    for (const fileName of ['../notes.txt', 'C:\\notes.txt', '', '..']) {
      await expect(service.uploadScreenplaySupportingMaterial({ ...input, fileName }))
        .rejects.toMatchObject({ code: 'SCREENPLAY_SUPPORTING_MATERIAL_INVALID_SOURCE' });
    }
  });

  it('preserves a successful upload and reports a warning when temporary cleanup fails', async () => {
    const rm = vi.spyOn(fs, 'rm').mockRejectedValueOnce(new Error('temporary folder is locked'));
    try {
      const report = await service.uploadScreenplaySupportingMaterial({
        projectName,
        homeDir,
        fileName: 'cleanup-warning.md',
        contents: new TextEncoder().encode('Imported before cleanup').buffer,
      });
      expect(report.status).toBe('imported');
      expect(report.warnings).toMatchObject([{
        code: 'SCREENPLAY_SUPPORTING_MATERIAL_UPLOAD_CLEANUP_FAILED',
        severity: 'warning',
        location: { filePath: expect.stringContaining('renku-supporting-upload-') },
      }]);
      const information = await service.resolveProjectSupportingFile({ projectName, homeDir, assetId: report.material.id });
      expect(await fs.readFile(information.absolutePath, 'utf8')).toBe('Imported before cleanup');
      expect(rm).toHaveBeenCalledWith(expect.any(String), {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 100,
      });
    } finally {
      rm.mockRestore();
    }
  });

  async function importFdx(extra = '') {
    const sourcePath = path.join(homeDir, 'screenplay.fdx');
    await fs.writeFile(sourcePath, '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="Scene Heading"><Text>INT. WORKSHOP - DAY</Text></Paragraph>'
      + `</Content>${extra}</FinalDraft>`);
    return service.importFdxScreenplay({ projectName, homeDir, sourcePath });
  }

  it('pages a mixed collection and protects current and historical FDX sources', async () => {
    const original = await importFdx();
    const revisions = await service.listScreenplayRevisions({ projectName, homeDir });
    const notes = await importNotes('research.md');
    const refreshed = await importFdx('<TitlePage/>');
    expect(refreshed.resourceKeys).toEqual(['surface:project:assets']);
    expect(await service.listScreenplayRevisions({ projectName, homeDir })).toEqual(revisions);
    expect(notes.resourceKeys).toEqual(['surface:project:assets']);
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const page = await service.listProjectSupportingFiles({ projectName, homeDir, limit: 1, cursor });
      expect(page.items).toHaveLength(1);
      ids.push(page.items[0]!.asset.id);
      cursor = page.nextCursor;
    } while (cursor);
    expect(new Set(ids).size).toBe(3);
    for (const assetId of [original.screenplayImport.sourceAssetId, refreshed.screenplayImport.sourceAssetId]) {
      expect((await service.readProjectSupportingFileInformation({ projectName, homeDir, assetId })).supportingFile.deleteBlock?.code)
        .toBe('SCREENPLAY_FDX_SOURCE_PROTECTED');
      await expect(service.discardProjectSupportingFile({ projectName, homeDir, assetId }))
        .rejects.toMatchObject({ code: 'SCREENPLAY_FDX_SOURCE_PROTECTED' });
      await expect(service.discardAsset({ projectName, homeDir, assetId, owner: { kind: 'project' } }))
        .rejects.toMatchObject({ code: 'SCREENPLAY_FDX_SOURCE_PROTECTED' });
    }
  });

  it('discards and restores supporting material without altering the external file', async () => {
    const imported = await importNotes('notes.txt', 'Exact retained bytes');
    const assetId = imported.material.id;
    const input = { projectName, homeDir, assetId };
    const information = await service.resolveProjectSupportingFile(input);
    expect(await fs.readFile(information.absolutePath, 'utf8')).toBe('Exact retained bytes');
    expect(information.supportingFile.deleteBlock).toBeNull();
    const discarded = await service.discardProjectSupportingFile(input);
    expect(discarded.resourceKeys).toContain('surface:project:assets');
    expect((await service.listProjectSupportingFiles({ projectName, homeDir })).items).toEqual([]);
    await expect(service.resolveProjectSupportingFile(input)).rejects.toMatchObject({ code: 'SCREENPLAY_SUPPORTING_FILE_INVALID_ASSET' });
    const restored = await service.restoreAsset(input);
    expect(restored.resourceKeys).toContain('surface:project:assets');
    expect((await service.listProjectSupportingFiles({ projectName, homeDir })).items).toHaveLength(1);
    expect(await fs.readFile(path.join(homeDir, 'notes.txt'), 'utf8')).toBe('Exact retained bytes');
  });

  it('keeps metadata readable for missing bytes and rejects files escaping the Project', async () => {
    const imported = await importNotes('notes.txt');
    const input = { projectName, homeDir, assetId: imported.material.id };
    const information = await service.readProjectSupportingFileInformation(input);
    await fs.rename(information.absolutePath, `${information.absolutePath}.removed`);
    expect((await service.readProjectSupportingFileInformation(input)).absolutePath).toBe(information.absolutePath);
    await expect(service.resolveProjectSupportingFile(input)).rejects.toMatchObject({ code: 'CORE_PROJECT_ASSET_FILE_NOT_FOUND' });
    await fs.symlink(path.join(homeDir, 'notes.txt'), information.absolutePath);
    await expect(service.resolveProjectSupportingFile(input)).rejects.toMatchObject({ code: 'CORE_PROJECT_ASSET_FILE_PATH_INVALID' });
  });

  it('does not resolve an Asset through a different Project', async () => {
    const imported = await importNotes('notes.txt');
    await createBlankMovieProject({ homeDir, projectData: service, projectName: 'other', title: 'Other' });
    await expect(service.readProjectSupportingFileInformation({ projectName: 'other', homeDir, assetId: imported.material.id }))
      .rejects.toMatchObject({ code: 'SCREENPLAY_SUPPORTING_FILE_INVALID_ASSET' });
  });
});
