import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectDataService } from '../index.js';
import { writeConfig } from '../testing/project-data-fixtures.js';

describe('deleteProject', () => {
  let homeDir: string;
  let storageRoot: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-delete-project-test-'));
    storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('permanently deletes the complete Project folder and closes its current descriptor', async () => {
    const projectData = createProjectDataService();
    const created = await projectData.createMovieProject({
      homeDir,
      projectName: 'the-glass-harbor',
      title: 'The Glass Harbor',
    });
    await fs.mkdir(path.join(created.projectPath, 'production', 'nested'), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(created.projectPath, 'production', 'nested', 'keep-until-delete.txt'),
      'project content'
    );
    await projectData.openCurrentProject({
      homeDir,
      projectName: created.projectName,
    });

    const report = await projectData.deleteProject({
      homeDir,
      projectName: created.projectName,
      confirmationProjectName: created.projectName,
    });

    expect(report).toEqual({
      projectName: created.projectName,
      projectPath: created.projectPath,
      deleted: true,
    });
    await expect(fs.stat(created.projectPath)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(projectData.readCurrentProject({ homeDir })).resolves.toBeNull();
  });

  it('rejects a mismatched confirmation before deleting Project contents', async () => {
    const projectData = createProjectDataService();
    const created = await projectData.createMovieProject({
      homeDir,
      projectName: 'the-glass-harbor',
      title: 'The Glass Harbor',
    });

    await expect(
      projectData.deleteProject({
        homeDir,
        projectName: created.projectName,
        confirmationProjectName: 'The Glass Harbor',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA027',
      issues: [
        {
          location: { path: ['confirmationProjectName'] },
        },
      ],
    });
    expect((await fs.stat(created.databasePath)).isFile()).toBe(true);
  });

  it('keeps the current Project descriptor when filesystem removal fails', async () => {
    const projectData = createProjectDataService();
    const created = await projectData.createMovieProject({
      homeDir,
      projectName: 'the-glass-harbor',
      title: 'The Glass Harbor',
    });
    await projectData.openCurrentProject({
      homeDir,
      projectName: created.projectName,
    });
    const originalRm = fs.rm;
    const rm = vi.spyOn(fs, 'rm').mockImplementation(async (target, options) => {
      if (target === created.projectPath) {
        throw Object.assign(new Error('Permission denied.'), { code: 'EACCES' });
      }
      return await originalRm(target, options);
    });

    try {
      await expect(
        projectData.deleteProject({
          homeDir,
          projectName: created.projectName,
          confirmationProjectName: created.projectName,
        })
      ).rejects.toMatchObject({ code: 'PROJECT_DATA026' });
    } finally {
      rm.mockRestore();
    }

    await expect(projectData.readCurrentProject({ homeDir })).resolves.toMatchObject({
      projectName: created.projectName,
      projectFolder: created.projectPath,
    });
    expect((await fs.stat(created.databasePath)).isFile()).toBe(true);
  });

  it('keeps a same-named Project in another storage root current', async () => {
    const projectData = createProjectDataService();
    const currentProject = await projectData.createMovieProject({
      homeDir,
      projectName: 'the-glass-harbor',
      title: 'The Glass Harbor',
    });
    await projectData.openCurrentProject({
      homeDir,
      projectName: currentProject.projectName,
    });

    const replacementStorageRoot = path.join(homeDir, 'replacement-projects');
    await writeConfig(homeDir, replacementStorageRoot);
    const deletedProject = await projectData.createMovieProject({
      homeDir,
      projectName: 'the-glass-harbor',
      title: 'The Glass Harbor Replacement',
    });

    await projectData.deleteProject({
      homeDir,
      projectName: deletedProject.projectName,
      confirmationProjectName: deletedProject.projectName,
    });

    await expect(projectData.readCurrentProject({ homeDir })).resolves.toMatchObject({
      projectName: currentProject.projectName,
      projectFolder: currentProject.projectPath,
    });
    expect((await fs.stat(currentProject.databasePath)).isFile()).toBe(true);
    await expect(fs.stat(deletedProject.projectPath)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('does not delete a folder that is not a SQLite-backed Project', async () => {
    const projectData = createProjectDataService();
    const folderPath = path.join(storageRoot, 'notes-only');
    const markerPath = path.join(folderPath, 'notes.txt');
    await fs.mkdir(folderPath, { recursive: true });
    await fs.writeFile(markerPath, 'keep me');

    await expect(
      projectData.deleteProject({
        homeDir,
        projectName: 'notes-only',
        confirmationProjectName: 'notes-only',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA020',
      issues: [{ location: { path: ['projectName'] } }],
    });
    await expect(fs.readFile(markerPath, 'utf8')).resolves.toBe('keep me');
  });
});
