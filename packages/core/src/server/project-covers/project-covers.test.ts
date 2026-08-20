import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AssetOwner } from '../../client/assets.js';
import { createAssetMembership } from '../assets/ownership.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { writeSelectedAssetRecord } from '../database/access/selected-assets.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { assetFiles } from '../schema/index.js';
import { createProjectDataService } from '../project-data-service.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';
import { readProjectFromSession } from '../resources/full-project.js';

const NOW = '2026-08-19T00:00:00.000Z';

describe('Project Cover selection and projection', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-project-cover-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('projects the selected Asset/File identity only on exact cover pages', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'cover.png'), 'cover');
    const report = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'project.cover',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/cover.png',
      select: true,
    });

    expect(report.resourceKeys).toEqual([
      'surface:project:covers',
      'project-shell',
      'project-library',
    ]);
    await expect(projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    })).resolves.toMatchObject({
      coverImage: {
        assetId: report.asset.id,
        assetFileId: report.asset.files[0]!.id,
      },
    });
    await expect(projectData.listAssetPage({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
      type: 'project_cover',
    })).resolves.toMatchObject({ selectedAssetId: report.asset.id });
    await expect(projectData.listAssetPage({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
    })).resolves.toMatchObject({ selectedAssetId: null });
    await expect(projectData.listAssetPage({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
      type: 'shot_plan_video',
    })).resolves.toMatchObject({ selectedAssetId: null });
  });

  it('keeps Project Cover Generation Context small and fixed to the display surface', async () => {
    const projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });

    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'project.cover',
      target: { kind: 'project', id: 'project' },
    });

    expect(context.facts).toEqual({ projectAspectRatio: '16:9' });
    expect(context.referenceGuide.sections).toEqual([]);
    expect(context.settings).toMatchObject({
      fixed: [{ kind: 'aspect-ratio', value: '16:9' }],
      recommended: [{ kind: 'quality', value: 'medium' }],
      recommendedModel: { provider: 'fal-ai', model: 'nano-banana-2' },
    });
    expect(context.models.length).toBeGreaterThan(0);
  });

  it('rejects unusable candidates before changing the prior selection', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      seedCover(session, 'asset_valid', { files: [{ id: 'file_valid', mediaKind: 'image' }] });
      seedCover(session, 'asset_no_primary', { files: [] });
      seedCover(session, 'asset_multiple', {
        files: [
          { id: 'file_multiple_1', mediaKind: 'image' },
          { id: 'file_multiple_2', mediaKind: 'image' },
        ],
      });
      seedCover(session, 'asset_video_primary', {
        files: [{ id: 'file_video_primary', mediaKind: 'video' }],
      });
      seedCover(session, 'asset_discarded_primary', {
        files: [{ id: 'file_discarded_primary', mediaKind: 'image' }],
      });
      session.db.update(assetFiles).set({ discardedAt: NOW }).where(
        eq(assetFiles.id, 'file_discarded_primary')
      ).run();
      seedCover(session, 'asset_wrong_owner', {
        owner: { kind: 'location', id: 'location_test0001' },
        files: [{ id: 'file_wrong_owner', mediaKind: 'image' }],
      });
      seedCover(session, 'asset_wrong_type', {
        type: 'shot_plan_video',
        files: [{ id: 'file_wrong_type', mediaKind: 'image' }],
      });
    } finally {
      session.close();
    }

    await projectData.selectAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'project' },
      assetId: 'asset_valid',
    });

    for (const assetId of [
      'asset_no_primary',
      'asset_multiple',
      'asset_video_primary',
      'asset_discarded_primary',
      'asset_wrong_owner',
      'asset_wrong_type',
    ]) {
      await expect(projectData.selectAsset({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'project' },
        assetId,
      })).rejects.toMatchObject({ code: 'CORE_ASSET_SELECTION_INVALID' });
      await expect(projectData.listAssetPage({
        projectName: 'constantinople',
        homeDir,
        owner: { kind: 'project' },
        type: 'project_cover',
      })).resolves.toMatchObject({ selectedAssetId: 'asset_valid' });
    }
  });

  it('fails defensively when stored selection is corrupt', async () => {
    const projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      seedCover(session, 'asset_corrupt', { files: [] });
      writeSelectedAssetRecord(session, {
        targetKey: 'project',
        assetId: 'asset_corrupt',
        now: NOW,
      });
      expect(() => readProjectFromSession({ session })).toThrow(
        expect.objectContaining({ code: 'CORE_ASSET_STORAGE_INVALID' })
      );
    } finally {
      session.close();
    }
  });

  it('refreshes exact cover surfaces through discard and restore', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'candidate.png'), 'candidate');
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'selected.png'), 'selected');
    const candidate = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'project.cover',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/candidate.png',
    });
    const selected = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'project.cover',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/selected.png',
      select: true,
    });

    const candidateDiscard = await projectData.discardAsset({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
      assetId: candidate.asset.id,
    });
    expect(candidateDiscard.resourceKeys).toEqual([
      'surface:project:covers',
      'trash:list',
    ]);
    await expect(projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    })).resolves.toMatchObject({
      coverImage: { assetId: selected.asset.id },
    });

    const restored = await projectData.restoreAsset({
      projectName: 'constantinople',
      homeDir,
      assetId: candidate.asset.id,
    });
    expect(restored.resourceKeys).toEqual(['surface:project:covers']);

    const selectedDiscard = await projectData.discardAsset({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
      assetId: selected.asset.id,
    });
    expect(selectedDiscard.resourceKeys).toEqual([
      'surface:project:covers',
      'project-shell',
      'project-library',
      'trash:list',
    ]);
    await expect(projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    })).resolves.toMatchObject({ coverImage: null });

    await projectData.restoreAsset({
      projectName: 'constantinople',
      homeDir,
      assetId: selected.asset.id,
    });
    await expect(projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    })).resolves.toMatchObject({ coverImage: null });
  });
});

function seedCover(
  session: Awaited<ReturnType<typeof openProjectSession>>['session'],
  assetId: string,
  input: {
    owner?: AssetOwner;
    type?: string;
    files: Array<{ id: string; mediaKind: string }>;
  }
): void {
  insertAssetRecord(session, {
    id: assetId,
    type: input.type ?? 'project_cover',
    mediaKind: 'image',
    title: assetId,
    origin: 'external',
    availability: 'ready',
    createdAt: NOW,
    updatedAt: NOW,
  });
  createAssetMembership(session, {
    assetId,
    owner: input.owner ?? { kind: 'project' },
    now: NOW,
  });
  for (const file of input.files) {
    insertAssetFileRecord(session, {
      id: file.id,
      assetId,
      role: 'primary',
      projectRelativePath: `covers/${file.id}.png`,
      mediaKind: file.mediaKind,
      createdAt: NOW,
      updatedAt: NOW,
    });
  }
}
