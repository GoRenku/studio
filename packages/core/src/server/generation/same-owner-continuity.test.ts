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
      owner: { kind: 'castMember', id: 'cast_test0001' },
      role: 'character-sheet', filename: 'first.png', title: 'First costume',
      oneLineSummary: 'Production palace costume.',
      referenceName: 'palace-production',
      tags: ['production', 'continuity'],
    });
    const second = await addAsset(created.projectPath, {
      owner: { kind: 'castMember', id: 'cast_test0001' },
      role: 'character-sheet', filename: 'second.png', title: 'Palace costume',
    });
    const unavailable = await addAsset(created.projectPath, {
      owner: { kind: 'castMember', id: 'cast_test0001' },
      role: 'character-sheet', filename: 'unavailable.png', title: 'Unavailable costume',
    });
    const session = openProjectStore({ projectFolder: created.projectPath, create: false });
    try {
      session.db.update(assets).set({ availability: 'pending' })
        .where(eq(assets.id, unavailable.id)).run();
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
      { kind: 'asset-file', assetId: first.id, assetFileId: first.files[0]!.id },
      { kind: 'asset-file', assetId: second.id, assetFileId: second.files[0]!.id },
    ]));
    expect(slot.eligibleCandidates.some((candidate) =>
      candidate.reference.kind === 'asset-file' && candidate.reference.assetId === unavailable.id
    )).toBe(false);
    expect(slot.eligibleCandidates.find((candidate) =>
      candidate.reference.kind === 'asset-file' && candidate.reference.assetId === first.id
    )).toMatchObject({
      oneLineSummary: 'Production palace costume.',
      referenceName: 'palace-production',
      tags: ['production', 'continuity'],
    });
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

  it('exposes same-Prop sheets as explicit candidates without automatic selection', async () => {
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const report = await projectData.applyPropOperations({
      homeDir,
      document: {
        kind: 'propOperations',
        operations: [
          {
            operation: 'prop.add',
            prop: {
              key: 'field-cannon',
              handle: 'field-cannon',
              name: 'Field Cannon',
            },
          },
        ],
      },
    });
    const propId = report.generatedIds?.[0]?.id as string;
    const first = await addAsset(created.projectPath, {
      owner: { kind: 'prop', id: propId },
      role: 'primary',
      filename: 'cannon-first.png',
      title: 'Cannon first sheet',
      type: 'prop_sheet',
    });
    const second = await addAsset(created.projectPath, {
      owner: { kind: 'prop', id: propId },
      role: 'primary',
      filename: 'cannon-second.png',
      title: 'Cannon second sheet',
      type: 'prop_sheet',
    });

    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'prop.sheet',
      target: { kind: 'prop', id: propId },
    });
    const slot = context.referenceGuide.sections
      .find((section) => section.id === 'prop')!.slots[0]!;
    expect(slot.eligibleCandidates.map((candidate) => candidate.reference)).toEqual(expect.arrayContaining([
      { kind: 'asset-file', assetId: second.id, assetFileId: second.files[0]!.id },
      { kind: 'asset-file', assetId: first.id, assetFileId: first.files[0]!.id },
    ]));
    expect(slot.eligibleCandidates).toHaveLength(2);
    expect('selections' in slot).toBe(false);
  });

  it('exposes both optional Lookbook appearance slots for every subject-sheet purpose', async () => {
    await createSampleMovieProject({ projectData, homeDir });
    const report = await projectData.applyPropOperations({
      homeDir,
      document: {
        kind: 'propOperations',
        operations: [{
          operation: 'prop.add',
          prop: { key: 'cannon', handle: 'cannon', name: 'Cannon' },
        }],
      },
    });
    const cases = [
      {
        purpose: 'cast.character-sheet' as const,
        target: { kind: 'castMember' as const, id: 'cast_test0001' },
      },
      {
        purpose: 'location.sheet' as const,
        target: { kind: 'location' as const, id: 'location_test0001' },
      },
      {
        purpose: 'prop.sheet' as const,
        target: { kind: 'prop' as const, id: report.generatedIds?.[0]?.id as string },
      },
    ];

    for (const item of cases) {
      const context = await projectData.buildGenerationContext({
        projectName: 'constantinople',
        homeDir,
        purpose: item.purpose,
        target: item.target,
      });
      const appearanceSlots = context.referenceGuide.sections
        .find((section) => section.id === 'visual-language')!.slots;
      expect(appearanceSlots.map((slot) => slot.id)).toEqual([
        'production-lookbook-sheet',
        'storyboard-lookbook-sheet',
      ]);
      expect(appearanceSlots.every((slot) => !('selection' in slot))).toBe(true);
    }
  });

  async function addAsset(
    projectPath: string,
    input: {
      owner: { kind: 'castMember' | 'prop'; id: string };
      role: string;
      filename: string;
      title: string;
      type?: 'character_sheet' | 'prop_sheet';
      oneLineSummary?: string;
      referenceName?: string;
      tags?: string[];
    }
  ) {
    const projectRelativePath = `references/${input.filename}` as ProjectRelativePath;
    await fs.mkdir(path.dirname(path.join(projectPath, projectRelativePath)), { recursive: true });
    await fs.writeFile(path.join(projectPath, projectRelativePath), input.title);
    return createTestAssetFixture({
      projectName: 'constantinople', homeDir, owner: input.owner,
      type: input.type ?? 'character_sheet', mediaKind: 'image', title: input.title,
      projectRelativePath, fileRole: 'primary', oneLineSummary: input.oneLineSummary,
      referenceName: input.referenceName, tags: input.tags,
    });
  }
});
