import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { createProjectDataService } from '../project-data-service.js';
import { writeConfig } from '../testing/project-data-fixtures.js';
import { offerStarNote, resolveStarNotePath } from './star-note.js';

describe('offerStarNote', () => {
  let homeDir: string;
  let storageRoot: string;
  let statePath: string;

  beforeEach(async () => {
    homeDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'renku-star-note-test-')));
    storageRoot = path.join(homeDir, 'library');
    statePath = resolveStarNotePath({ homeDir });
    await writeConfig(homeDir, storageRoot);
    await createProjectDataService().createMovieProject({ homeDir, projectName: 'night-market', title: 'Night Market' });
  });

  function addAssetFile(input: { type: string; origin: string; discarded?: boolean }) {
    const session = openProjectStore({ projectFolder: path.join(storageRoot, 'night-market'), create: false });
    try {
      const now = new Date().toISOString();
      const id = `asset_file_${input.type}_${input.origin}_${input.discarded ? 'discarded' : 'live'}`;
      insertAssetFileRecord(session, {
        id,
        ownerKey: 'project',
        projectRelativePath: `media/${id}.png`,
        type: input.type,
        mediaKind: input.type === 'shot_plan_video' ? 'video' : 'image',
        origin: input.origin,
        availability: 'ready',
        createdAt: now,
        updatedAt: now,
        discardedAt: input.discarded ? now : null,
      });
    } finally {
      session.close();
    }
  }

  it('does not show or record anything for a project without generated media', async () => {
    await expect(offerStarNote({ homeDir, projectName: 'night-market' })).resolves.toEqual({ show: false });
    await expect(fs.stat(statePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it.each(['shot_plan_video', 'scene_storyboard_image', 'character_sheet', 'location_sheet'])(
    'shows once for a generated %s and records it',
    async (type) => {
      addAssetFile({ type, origin: 'generated' });

      await expect(offerStarNote({ homeDir, projectName: 'night-market' })).resolves.toEqual({ show: true });
      const state = JSON.parse(await fs.readFile(statePath, 'utf8'));
      expect(state.version).toBe(1);
      expect(new Date(state.shownAt).toISOString()).toBe(state.shownAt);

      await expect(offerStarNote({ homeDir, projectName: 'night-market' })).resolves.toEqual({ show: false });
    }
  );

  it('ignores imported sheets and generated files in Trash', async () => {
    addAssetFile({ type: 'character_sheet', origin: 'imported' });
    addAssetFile({ type: 'location_sheet', origin: 'generated', discarded: true });

    await expect(offerStarNote({ homeDir, projectName: 'night-market' })).resolves.toEqual({ show: false });
  });

  it('answers from the state file without opening the project once shown', async () => {
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, JSON.stringify({ version: 1, shownAt: '2026-10-01T00:00:00.000Z' }));

    await expect(offerStarNote({ homeDir, projectName: 'missing-project' })).resolves.toEqual({ show: false });
  });

  it('never shows or records for the sample film', async () => {
    await expect(offerStarNote({ homeDir, projectName: 'sample-project' })).resolves.toEqual({ show: false });
    await expect(fs.stat(statePath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects an invalid state file', async () => {
    addAssetFile({ type: 'character_sheet', origin: 'generated' });
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(statePath, '{"version":2}');

    await expect(offerStarNote({ homeDir, projectName: 'night-market' }))
      .rejects.toMatchObject({ code: 'STAR_NOTE_STATE_INVALID' });
  });

  it('never shows when the state cannot be written', async () => {
    addAssetFile({ type: 'character_sheet', origin: 'generated' });
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.chmod(path.dirname(statePath), 0o500);

    try {
      await expect(offerStarNote({ homeDir, projectName: 'night-market' }))
        .rejects.toMatchObject({ code: 'STAR_NOTE_STATE_WRITE_FAILED' });
      await expect(fs.stat(statePath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await fs.chmod(path.dirname(statePath), 0o700);
    }
  });
});
