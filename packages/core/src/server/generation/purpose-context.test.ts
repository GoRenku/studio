import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../index.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { assetFiles, assetMemberships, assets } from '../schema/index.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('Scene generation context', () => {
  let homeDir: string;
  const projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-scene-generation-context-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('projects opaque narrative text and every exact owned continuity file', async () => {
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
    expect(castSlot.label).toBe(screenplay.screenplay!.cast[1]!.name);
    expect(castSlot.mediaKind).toBe('image');
    expect(castSlot.eligibleCandidates.map((candidate) => candidate.reference)).toEqual(expect.arrayContaining([
      { kind: 'asset-file', assetId: 'asset_cast_selected', assetFileId: 'asset_file_cast_selected' },
      { kind: 'asset-file', assetId: 'asset_cast_take', assetFileId: 'asset_file_cast_take' },
    ]));
    expect(castSlot.eligibleCandidates.some((candidate) =>
      candidate.reference.kind === 'asset-file' &&
      candidate.reference.assetId === 'asset_generic_reference'
    )).toBe(false);
    const locationSlot = context.referenceGuide.sections.find((section) => section.id === 'location')!.slots[0]!;
    expect(locationSlot.label).toBe(
      screenplay.screenplay!.locations[0]!.name
    );
    expect(locationSlot.mediaKind).toBe('image');
    expect(locationSlot.eligibleCandidates.map((candidate) => candidate.reference)).toEqual([
      { kind: 'asset-file', assetId: 'asset_location_selected', assetFileId: 'asset_file_location_selected' },
    ]);

  });

  it('warns when optional Shot Plan video reference candidates are unavailable', async () => {
    const created = await createSampleMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    const shotPlan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene.id!,
      title: 'Video authoring source',
      coverage: null,
      shots: [],
    });

    const context = await projectData.buildGenerationContext({
      projectName: 'constantinople',
      homeDir,
      purpose: 'shot-plan.video-generation',
      target: { kind: 'project', id: 'constantinople' },
      authoredFrom: { kind: 'shotPlan', id: shotPlan.shotPlan.id },
    });

    expect(context.referenceGuide.notices).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CORE_GENERATION_OPTIONAL_REFERENCE_UNAVAILABLE',
      }),
    ]));
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
      asset('asset_cast_selected', 'character_sheet', 'Selected Cast Sheet', now),
      asset('asset_cast_take', 'character_sheet', 'Cast Take', now),
      asset('asset_location_selected', 'location_sheet', 'Selected Location Sheet', now),
      asset('asset_generic_reference', 'reference', 'Generic Maria Reference', now),
    ]).run();
    session.db.insert(assetFiles).values([
      assetFile('asset_file_cast_selected', 'asset_cast_selected', 'cast-selected.png', now),
      assetFile('asset_file_cast_take', 'asset_cast_take', 'cast-take.png', now),
      assetFile('asset_file_location_selected', 'asset_location_selected', 'location-selected.png', now),
      assetFile('asset_file_generic_reference', 'asset_generic_reference', 'generic-reference.png', now),
    ]).run();
    session.db.insert(assetMemberships).values([
      membership('asset_cast_selected', `castMember:${ids.castMemberId}`, now),
      membership('asset_cast_take', `castMember:${ids.castMemberId}`, now),
      membership('asset_location_selected', `location:${ids.locationId}`, now),
      membership('asset_generic_reference', 'project', now),
    ]).run();
  } finally {
    session.close();
  }
}

function asset(id: string, type: string, title: string, now: string) {
  return { id, type, mediaKind: 'image', title, origin: 'generated', availability: 'ready', createdAt: now, updatedAt: now };
}

function assetFile(id: string, assetId: string, filename: string, now: string) {
  return { id, assetId, role: 'primary', projectRelativePath: `references/${filename}`, mediaKind: 'image', mimeType: 'image/png', createdAt: now, updatedAt: now };
}

function membership(assetId: string, ownerKey: string, now: string) {
  return { assetId, ownerKey, createdAt: now, updatedAt: now };
}
