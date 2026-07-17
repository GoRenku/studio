import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService, type ProjectRelativePath } from '../index.js';
import { readCastProfileDisplayAssetId, readLocationHeroDisplayAssetId } from '../database/access/display-assets.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { assets } from '../schema/index.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('focused display asset commands', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-display-assets-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('sets and clears only an exact ready Cast Profile for its owner', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const profile = await asset(created.projectPath, {
      target: { kind: 'castMember', castMemberId: 'cast_test0001' },
      role: 'profile', title: 'Profile', filename: 'profile.png',
    });
    const sheet = await asset(created.projectPath, {
      target: { kind: 'castMember', castMemberId: 'cast_test0001' },
      role: 'character-sheet', title: 'Sheet', filename: 'sheet.png',
    });

    await expect(projectData.setCastProfileDisplayAsset({
      projectName: 'constantinople', homeDir, castMemberId: 'cast_test0002', assetId: profile.assetId,
    })).rejects.toMatchObject({ code: 'CORE_DISPLAY_ASSET_INVALID' });
    await expect(projectData.setCastProfileDisplayAsset({
      projectName: 'constantinople', homeDir, castMemberId: 'cast_test0001', assetId: sheet.assetId,
    })).rejects.toMatchObject({ code: 'CORE_DISPLAY_ASSET_INVALID' });

    const selected = await projectData.setCastProfileDisplayAsset({
      projectName: 'constantinople', homeDir, castMemberId: 'cast_test0001', assetId: profile.assetId,
    });
    expect(selected).toMatchObject({
      valid: true,
      project: { name: 'constantinople', projectFolder: created.projectPath },
      asset: { assetId: profile.assetId },
      resourceKeys: ['surface:castMember:cast_test0001'],
    });
    const session = openProjectStore({ projectFolder: created.projectPath, create: false });
    try {
      expect(readCastProfileDisplayAssetId(session, 'cast_test0001')).toBe(profile.assetId);
      session.db.update(assets).set({ availability: 'pending' }).where(eq(assets.id, profile.assetId)).run();
    } finally {
      session.close();
    }
    await expect(projectData.setCastProfileDisplayAsset({
      projectName: 'constantinople', homeDir, castMemberId: 'cast_test0001', assetId: profile.assetId,
    })).rejects.toMatchObject({ code: 'CORE_DISPLAY_ASSET_INVALID' });
    const clearReport = await projectData.clearCastProfileDisplayAsset({
      projectName: 'constantinople', homeDir, castMemberId: 'cast_test0001',
    });
    expect(clearReport).toMatchObject({
      asset: null,
      resourceKeys: ['surface:castMember:cast_test0001'],
    });
    const cleared = openProjectStore({ projectFolder: created.projectPath, create: false });
    try {
      expect(readCastProfileDisplayAssetId(cleared, 'cast_test0001')).toBeNull();
    } finally {
      cleared.close();
    }
  });

  it('stores Location Hero display state separately', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const hero = await asset(created.projectPath, {
      target: { kind: 'location', locationId: 'location_test0001' },
      role: 'hero', title: 'Hero', filename: 'hero.png',
    });
    const selected = await projectData.setLocationHeroDisplayAsset({
      projectName: 'constantinople', homeDir, locationId: 'location_test0001', assetId: hero.assetId,
    });
    expect(selected).toMatchObject({
      valid: true,
      asset: { assetId: hero.assetId },
      resourceKeys: ['surface:location:location_test0001'],
    });
    const session = openProjectStore({ projectFolder: created.projectPath, create: false });
    try {
      expect(readLocationHeroDisplayAssetId(session, 'location_test0001')).toBe(hero.assetId);
    } finally {
      session.close();
    }
  });

  async function asset(
    projectPath: string,
    input: {
      target: { kind: 'castMember'; castMemberId: string } | { kind: 'location'; locationId: string };
      role: string;
      title: string;
      filename: string;
    }
  ) {
    const relativePath = `references/${input.filename}` as ProjectRelativePath;
    await fs.mkdir(path.dirname(path.join(projectPath, relativePath)), { recursive: true });
    await fs.writeFile(path.join(projectPath, relativePath), input.title);
    return createTestAssetFixture({
      projectName: 'constantinople', homeDir, target: input.target,
      type: input.role, mediaKind: 'image', title: input.title,
      projectRelativePath: relativePath, fileRole: 'primary', role: input.role,
    });
  }
});
