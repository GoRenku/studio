import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneShotListDocument } from '../../client/scene-shot-list.js';
import { createDeterministicIdGenerator, createProjectDataService } from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('scene shot list commands', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-scene-shot-list-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  it('returns scene-specific shot-list context', async () => {
    const ids = await sampleIds();
    const context = await projectData.readSceneShotListContext({
      homeDir,
      sceneId: ids.sceneId,
    });

    expect(context.valid).toBe(true);
    expect(context.project.aspectRatio).toBe('16:9');
    expect(context.scene.title).toBe('A Throne Facing an Ancient City');
    expect(context.cast).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.castMemberId })])
    );
    expect(context.locations).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: ids.locationId })])
    );
    expect(context.activeShotList).toBeNull();
  });

  it('validates shot lists and reports structured reference failures', async () => {
    const ids = await sampleIds();
    const valid = sampleShotList(ids);

    await expect(
      projectData.validateSceneShotList({ homeDir, document: valid })
    ).resolves.toMatchObject({ valid: true });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...valid,
          shots: [
            {
              ...valid.shots[0]!,
              shotId: 'shot_001_duplicate',
              coveredBlockIndexes: [99],
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA320',
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('outside the scene'),
        }),
      ]),
    });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...valid,
          shots: [{ ...valid.shots[0]!, castMemberIds: ['cast_missing'] }],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('unknown cast member'),
        }),
      ]),
    });

    await expect(
      projectData.validateSceneShotList({
        homeDir,
        document: {
          ...valid,
          shots: [
            valid.shots[0]!,
            {
              ...valid.shots[0]!,
              title: 'Duplicate identifier',
              locationIds: ['location_missing'],
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('Duplicate shotId'),
        }),
        expect.objectContaining({
          message: expect.stringContaining('unknown location'),
        }),
      ]),
    });
  });

  it('writes shot-list history, sets active, and preserves older rows', async () => {
    const ids = await sampleIds();
    const idGenerator = createDeterministicIdGenerator();
    const first = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids, 'First pass'),
      idGenerator,
    });
    const second = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids, 'Second pass'),
      idGenerator,
    });

    expect(first.shotList.id).not.toEqual(second.shotList.id);
    expect(second.activeShotListId).toBe(second.shotList.id);

    const list = await projectData.listSceneShotLists({
      homeDir,
      sceneId: ids.sceneId,
    });
    expect(list.shotLists.map((shotList) => shotList.id)).toEqual(
      expect.arrayContaining([first.shotList.id, second.shotList.id])
    );

    await projectData.setActiveSceneShotList({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: first.shotList.id,
    });

    await expect(
      projectData.readSceneShotList({
        homeDir,
        active: true,
        sceneId: ids.sceneId,
      })
    ).resolves.toMatchObject({
      summary: { id: first.shotList.id },
      shotList: { title: 'First pass' },
    });
  });

  it('imports one compound storyboard sheet asset with per-shot images', async () => {
    const ids = await sampleIds();
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });
    const project = await projectData.readCurrentProject({ homeDir });
    expect(project).not.toBeNull();
    const sheetPath = path.join(
      project!.projectFolder,
      'generated',
      'media',
      'sheet.png'
    );
    const shotPath = path.join(
      project!.projectFolder,
      'generated',
      'media',
      'shot.png'
    );
    await fs.mkdir(path.dirname(sheetPath), { recursive: true });
    await fs.writeFile(sheetPath, 'sheet');
    await fs.writeFile(shotPath, 'shot');

    await expect(
      projectData.importSceneStoryboardSheetMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardSheetImport',
          sheet: { source: 'generated/media/sheet.png' },
          shots: [
            { shotId: 'shot_001', source: 'generated/media/missing-shot.png' },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA342',
    });

    await expect(
      projectData.importSceneStoryboardSheetMedia({
        homeDir,
        sceneId: ids.sceneId,
        shotListId: written.shotList.id,
        document: {
          kind: 'sceneStoryboardSheetImport',
          sheet: { source: 'generated/media/sheet.png' },
          shots: [{ shotId: 'shot_missing', source: 'generated/media/shot.png' }],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA325',
    });

    const report = await projectData.importSceneStoryboardSheetMedia({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      document: {
        kind: 'sceneStoryboardSheetImport',
        sheet: { source: 'generated/media/sheet.png' },
        shots: [{ shotId: 'shot_001', source: 'generated/media/shot.png' }],
      },
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(report.imported.type).toBe('scene_storyboard_sheet');
    expect(report.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'sheet' }),
        expect.objectContaining({ role: 'shot', shotId: 'shot_001' }),
      ])
    );
    expect(report.resourceKeys).toEqual(
      expect.arrayContaining([
        `scene-shot-list:${written.shotList.id}:shot:shot_001`,
      ])
    );
  });

  it('validates scene storyboard sheet specs and preserves binding options', async () => {
    const ids = await sampleIds();
    const written = await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList(ids),
      idGenerator: createDeterministicIdGenerator(),
    });

    const context = await projectData.buildSceneStoryboardSheetContext({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
    });
    expect(context.defaults.visualizationStyle).toBe('charcoalPencil');

    await expect(
      projectData.validateSceneStoryboardSheetSpec({
        homeDir,
        spec: {
          purpose: 'scene.storyboard-sheet',
          target: { kind: 'scene', id: ids.sceneId },
          shotListId: written.shotList.id,
          modelChoice: 'fal-ai/nano-banana-2',
          prompt: 'A clean one-panel storyboard sheet for this one-shot scene.',
          visualizationStyle: 'charcoalPencil',
          takeCount: 1,
          imageFrame: 'project',
          detail: 'standard',
          outputFormat: 'png',
        },
      })
    ).resolves.toMatchObject({
      valid: true,
      spec: {
        visualizationStyle: 'charcoalPencil',
        takeCount: 1,
      },
      providerPayload: {
        aspect_ratio: '16:9',
      },
    });
  });

  async function sampleIds() {
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay!.acts[0]!.sequences[0]!.scenes[0]!;
    return {
      sceneId: scene.id as string,
      castMemberId: screenplay.screenplay!.cast[1]!.id as string,
      locationId: screenplay.screenplay!.locations[0]!.id as string,
    };
  }
});

function sampleShotList(
  ids: { sceneId: string; castMemberId: string; locationId: string },
  title = 'Council chamber coverage'
): SceneShotListDocument {
  return {
    kind: 'sceneShotList',
    sceneId: ids.sceneId,
    title,
    summary: 'A restrained one-shot coverage plan for the first scene.',
    coverageStrategy:
      'Hold the map table and Mehmed in one composed frame to emphasize planning.',
    lookbookInfluence: 'Use the project aspect ratio unless a shot specifies otherwise.',
    shots: [
      {
        shotId: 'shot_001',
        title: 'Map study',
        storyBeat: 'Mehmed studies the city map before the siege plan hardens.',
        narrativePurpose: 'Establish the strategic obsession driving the scene.',
        description: 'Wide static shot of Mehmed at the table with the map visible.',
        shotType: 'wide',
        cameraAngle: 'eye level',
        cameraMovement: 'static',
        framing: 'centered table composition',
        lensIntent: 'moderate wide lens feel',
        subject: 'Mehmed and the city map',
        action: 'Mehmed studies the map in silence.',
        dialogue: [],
        coveredBlockIndexes: [0],
        castMemberIds: [ids.castMemberId],
        locationIds: [ids.locationId],
        audioNotes: 'Quiet room tone and paper movement.',
        productionNotes: 'Keep warm lamplight restrained.',
      },
    ],
  };
}
