import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService, type ProjectRelativePath } from '../index.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { assets } from '../schema/index.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('same-owner generation continuity slots', () => {
  let homeDir: string;
  const projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-continuity-slots-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('exposes every ready prior Cast sheet without choosing a default', async () => {
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const first = await addAsset(created.projectPath, {
      target: { kind: 'castMember', castMemberId: 'cast_test0001' },
      role: 'character-sheet', filename: 'first.png', title: 'First costume',
    });
    const second = await addAsset(created.projectPath, {
      target: { kind: 'castMember', castMemberId: 'cast_test0001' },
      role: 'character-sheet', filename: 'second.png', title: 'Palace costume',
    });
    const unavailable = await addAsset(created.projectPath, {
      target: { kind: 'castMember', castMemberId: 'cast_test0001' },
      role: 'character-sheet', filename: 'unavailable.png', title: 'Unavailable costume',
    });
    const session = openProjectStore({ projectFolder: created.projectPath, create: false });
    try {
      session.db.update(assets).set({ availability: 'pending' })
        .where(eq(assets.id, unavailable.assetId)).run();
    } finally {
      session.close();
    }

    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople', homeDir, purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: 'cast_test0001' },
    });
    const slot = context.referenceGuide.sections
      .find((section) => section.id === 'cast')!.slots[0]!;
    expect(slot.eligibleCandidates.map((candidate) => candidate.reference)).toEqual(expect.arrayContaining([
      { kind: 'asset-file', assetId: first.assetId, assetFileId: first.files[0]!.id },
      { kind: 'asset-file', assetId: second.assetId, assetFileId: second.files[0]!.id },
    ]));
    expect(slot.eligibleCandidates.some((candidate) =>
      candidate.reference.kind === 'asset-file' && candidate.reference.assetId === unavailable.assetId
    )).toBe(false);
    expect('selections' in slot).toBe(false);
  });

  it('keeps an empty same-Location slot valid for the first sheet', async () => {
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople', homeDir, purpose: 'location.sheet',
      target: { kind: 'location', id: 'location_test0001' },
    });
    const slot = context.referenceGuide.sections
      .find((section) => section.id === 'location')!.slots[0]!;
    expect(slot.eligibleCandidates).toEqual([]);
  });

  async function addAsset(
    projectPath: string,
    input: {
      target: { kind: 'castMember'; castMemberId: string };
      role: string;
      filename: string;
      title: string;
    }
  ) {
    const projectRelativePath = `references/${input.filename}` as ProjectRelativePath;
    await fs.mkdir(path.dirname(path.join(projectPath, projectRelativePath)), { recursive: true });
    await fs.writeFile(path.join(projectPath, projectRelativePath), input.title);
    return createTestAssetFixture({
      projectName: 'constantinople', homeDir, target: input.target,
      type: input.role, mediaKind: 'image', title: input.title,
      projectRelativePath, fileRole: 'primary', role: input.role,
    });
  }
});
