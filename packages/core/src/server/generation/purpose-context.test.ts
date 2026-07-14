import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../index.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { assetFiles, assets, castAssets, locationAssets } from '../schema/index.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('Scene generation context', () => {
  let homeDir: string;
  const projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-scene-generation-context-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('projects opaque narrative text and exact selected continuity files', async () => {
    const created = await createSampleMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    const castMemberId = screenplay.screenplay!.cast[1]!.id!;
    const locationId = screenplay.screenplay!.locations[0]!.id!;
    seedContinuityAssets(created.projectPath, { castMemberId, locationId });

    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'scene.storyboard-sheet',
      target: { kind: 'scene', id: scene.id! },
    });

    expect(context.facts.contextText).toBe(
      'INT — A Throne Facing an Ancient City — NIGHT\n\nMehmed studies the city map.'
    );
    expect(context.facts.sceneCastMemberIds).toEqual([castMemberId]);
    expect(context.facts.sceneLocationIds).toEqual([locationId]);
    const castSlot = context.referenceGuide.sections.find((section) => section.id === 'cast')!.slots[0]!;
    expect(castSlot.candidates.map((candidate) => candidate.reference)).toEqual(expect.arrayContaining([
      { kind: 'asset-file', assetId: 'asset_cast_selected', assetFileId: 'asset_file_cast_selected' },
      { kind: 'asset-file', assetId: 'asset_cast_take', assetFileId: 'asset_file_cast_take' },
    ]));
    expect(castSlot.selections.map((selection) => selection.reference)).toEqual([
      { kind: 'asset-file', assetId: 'asset_cast_selected', assetFileId: 'asset_file_cast_selected' },
    ]);
    const locationSlot = context.referenceGuide.sections.find((section) => section.id === 'location')!.slots[0]!;
    expect(locationSlot.selections.map((selection) => selection.reference)).toEqual([
      { kind: 'asset-file', assetId: 'asset_location_selected', assetFileId: 'asset_file_location_selected' },
    ]);
  });
});

function seedContinuityAssets(
  projectFolder: string,
  ids: { castMemberId: string; locationId: string }
): void {
  const session = openProjectStore({ projectFolder, create: false });
  const now = '2026-07-14T10:00:00.000Z';
  try {
    session.db.insert(assets).values([
      asset('asset_cast_selected', 'Selected Cast Sheet', now),
      asset('asset_cast_take', 'Cast Take', now),
      asset('asset_location_selected', 'Selected Location Sheet', now),
    ]).run();
    session.db.insert(assetFiles).values([
      assetFile('asset_file_cast_selected', 'asset_cast_selected', 'cast-selected.png', now),
      assetFile('asset_file_cast_take', 'asset_cast_take', 'cast-take.png', now),
      assetFile('asset_file_location_selected', 'asset_location_selected', 'location-selected.png', now),
    ]).run();
    session.db.insert(castAssets).values([
      relationship('cast_asset_selected', 'asset_cast_selected', ids.castMemberId, 'character-sheet', 'select', 1, now),
      relationship('cast_asset_take', 'asset_cast_take', ids.castMemberId, 'character-sheet', 'take', null, now),
    ]).run();
    session.db.insert(locationAssets).values(
      relationship('location_asset_selected', 'asset_location_selected', ids.locationId, 'location-sheet', 'select', 1, now)
    ).run();
  } finally {
    session.close();
  }
}

function asset(id: string, title: string, now: string) {
  return { id, type: 'reference', mediaKind: 'image', title, origin: 'generated', availability: 'ready', createdAt: now, updatedAt: now };
}

function assetFile(id: string, assetId: string, filename: string, now: string) {
  return { id, assetId, role: 'primary', projectRelativePath: `references/${filename}`, mediaKind: 'image', mimeType: 'image/png', createdAt: now, updatedAt: now };
}

function relationship(id: string, assetId: string, ownerId: string, role: string, selection: string, selectionOrder: number | null, now: string) {
  return { id, assetId, castMemberId: ownerId, locationId: ownerId, role, sortOrder: 1, selection, selectionOrder, createdAt: now, updatedAt: now };
}
