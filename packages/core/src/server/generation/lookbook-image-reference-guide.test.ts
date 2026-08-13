import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AssetOwner, ProjectRelativePath } from '../../client/index.js';
import { createProjectDataService } from '../index.js';
import { insertLookbookImageRecord } from '../database/access/lookbook-images.js';
import {
  insertLookbookRecord,
  readLookbookRecordByKind,
} from '../database/access/lookbook.js';
import { insertLookbookSheetRecord } from '../database/access/lookbook-sheets.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { lookbookImages } from '../schema/index.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('Lookbook image generation reference guide', () => {
  let homeDir: string;
  const projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-lookbook-image-guide-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('exposes only active images and the sheet from the target Storyboard Lookbook', async () => {
    const created = await createSampleMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }
    const lookbooks = ensureLookbooks(created.projectPath);
    const accepted = await addLookbookImage(created.projectPath, {
      lookbookId: lookbooks.storyboard,
      filename: 'accepted-storyboard-style.png',
      title: 'Accepted Storyboard Style',
      imageId: 'lookbook_image_storyboard_accepted',
    });
    const discarded = await addLookbookImage(created.projectPath, {
      lookbookId: lookbooks.storyboard,
      filename: 'discarded-storyboard-style.png',
      title: 'Discarded Storyboard Style',
      imageId: 'lookbook_image_storyboard_discarded',
    });
    const productionImage = await addLookbookImage(created.projectPath, {
      lookbookId: lookbooks.production,
      filename: 'production-style.png',
      title: 'Production Style',
      imageId: 'lookbook_image_production',
    });
    const storyboardSheet = await addLookbookSheet(created.projectPath, {
      lookbookId: lookbooks.storyboard,
      filename: 'storyboard-sheet.png',
      title: 'Storyboard Lookbook Sheet',
      sheetId: 'lookbook_sheet_storyboard',
    });
    const productionSheet = await addLookbookSheet(created.projectPath, {
      lookbookId: lookbooks.production,
      filename: 'production-sheet.png',
      title: 'Production Lookbook Sheet',
      sheetId: 'lookbook_sheet_production',
    });
    const session = openProjectStore({ projectFolder: created.projectPath, create: false });
    try {
      session.db.update(lookbookImages)
        .set({ discardedAt: '2026-08-13T10:00:00.000Z' })
        .where(eq(lookbookImages.id, discarded.imageId)).run();
    } finally {
      session.close();
    }

    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: lookbooks.storyboard },
    });
    const section = context.referenceGuide.sections
      .find((candidate) => candidate.id === 'visual-language')!;
    expect(section.slots.map((slot) => slot.id)).toEqual([
      'lookbook-style-reference',
      'storyboard-lookbook-sheet',
    ]);
    const styleSlot = section.slots[0]!;
    expect(styleSlot.guidance).toContain('preserve visual style');
    expect(styleSlot.eligibleCandidates.map((candidate) => candidate.reference)).toEqual([
      assetFileReference(accepted.assetId, accepted.assetFileId),
    ]);
    expect(styleSlot.eligibleCandidates).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ reference: assetFileReference(productionImage.assetId, productionImage.assetFileId) }),
    ]));
    expect('selections' in styleSlot).toBe(false);
    expect(section.slots[1]!.eligibleCandidates.map((candidate) => candidate.reference)).toEqual([
      assetFileReference(storyboardSheet.assetId, storyboardSheet.assetFileId),
    ]);
    expect(section.slots[1]!.eligibleCandidates).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ reference: assetFileReference(productionSheet.assetId, productionSheet.assetFileId) }),
    ]));
  });

  it('uses Production Lookbook references and keeps an empty style slot valid', async () => {
    const created = await createSampleMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }
    const lookbooks = ensureLookbooks(created.projectPath);
    const productionSheet = await addLookbookSheet(created.projectPath, {
      lookbookId: lookbooks.production,
      filename: 'production-sheet.png',
      title: 'Production Lookbook Sheet',
      sheetId: 'lookbook_sheet_production',
    });

    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: lookbooks.production },
    });
    const section = context.referenceGuide.sections
      .find((candidate) => candidate.id === 'visual-language')!;
    expect(section.slots.map((slot) => slot.id)).toEqual([
      'lookbook-style-reference',
      'production-lookbook-sheet',
    ]);
    expect(section.slots[0]!.eligibleCandidates).toEqual([]);
    expect(section.slots[1]!.eligibleCandidates.map((candidate) => candidate.reference)).toEqual([
      assetFileReference(productionSheet.assetId, productionSheet.assetFileId),
    ]);
  });

  function ensureLookbooks(projectPath: string): { production: string; storyboard: string } {
    const session = openProjectStore({ projectFolder: projectPath, create: false });
    try {
      const now = '2026-08-13T09:00:00.000Z';
      const production = readLookbookRecordByKind(session, 'production')?.id ?? 'lookbook_production_guide';
      const storyboard = readLookbookRecordByKind(session, 'storyboard')?.id ?? 'lookbook_storyboard_guide';
      if (!readLookbookRecordByKind(session, 'production')) {
        insertLookbookRecord(session, {
          id: production,
          name: 'Production Lookbook',
          kind: 'production',
          definitionJson: '{}',
          now,
        });
      }
      if (!readLookbookRecordByKind(session, 'storyboard')) {
        insertLookbookRecord(session, {
          id: storyboard,
          name: 'Storyboard Lookbook',
          kind: 'storyboard',
          definitionJson: '{}',
          now,
        });
      }
      return { production, storyboard };
    } finally {
      session.close();
    }
  }

  async function addLookbookImage(
    projectPath: string,
    input: { lookbookId: string; filename: string; title: string; imageId: string }
  ) {
    const asset = await addLookbookAsset(projectPath, {
      lookbookId: input.lookbookId,
      filename: input.filename,
      title: input.title,
      type: 'lookbook_image',
    });
    const session = openProjectStore({ projectFolder: projectPath, create: false });
    try {
      insertLookbookImageRecord(session, {
        id: input.imageId,
        assetId: asset.id,
        sortOrder: 1,
        now: '2026-08-13T09:30:00.000Z',
      });
    } finally {
      session.close();
    }
    return { imageId: input.imageId, assetId: asset.id, assetFileId: asset.files[0]!.id };
  }

  async function addLookbookSheet(
    projectPath: string,
    input: { lookbookId: string; filename: string; title: string; sheetId: string }
  ) {
    const asset = await addLookbookAsset(projectPath, {
      lookbookId: input.lookbookId,
      filename: input.filename,
      title: input.title,
      type: 'lookbook_sheet',
    });
    const session = openProjectStore({ projectFolder: projectPath, create: false });
    try {
      insertLookbookSheetRecord(session, {
        id: input.sheetId,
        assetId: asset.id,
        sortOrder: 1,
        now: '2026-08-13T09:30:00.000Z',
      });
    } finally {
      session.close();
    }
    return { assetId: asset.id, assetFileId: asset.files[0]!.id };
  }

  async function addLookbookAsset(
    projectPath: string,
    input: { lookbookId: string; filename: string; title: string; type: string }
  ) {
    const projectRelativePath = `references/${input.filename}` as ProjectRelativePath;
    await fs.mkdir(path.dirname(path.join(projectPath, projectRelativePath)), { recursive: true });
    await fs.writeFile(path.join(projectPath, projectRelativePath), input.title);
    return createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'lookbook', id: input.lookbookId } satisfies AssetOwner,
      type: input.type,
      mediaKind: 'image',
      title: input.title,
      projectRelativePath,
      fileRole: 'primary',
    });
  }
});

function assetFileReference(assetId: string, assetFileId: string) {
  return { kind: 'asset-file' as const, assetId, assetFileId };
}
