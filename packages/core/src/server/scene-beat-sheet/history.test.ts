import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneBeatSheetDocument } from '../../client/scene-beat-sheet.js';
import { createDeterministicIdGenerator, createProjectDataService } from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('scene Beat Sheet commands', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-scene-beat-sheet-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ projectData, homeDir });
  });

  it('returns scene-specific beat-sheet context', async () => {
    const ids = await sampleIds();
    const context = await projectData.readSceneBeatSheetContext({
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
    expect(context.activeBeatSheet).toBeNull();
  });

  it('validates Beat Sheets and reports structured reference failures', async () => {
    const ids = await sampleIds();
    const valid = sampleBeatSheet(ids);

    await expect(
      projectData.validateSceneBeatSheet({ homeDir, document: valid })
    ).resolves.toMatchObject({ valid: true });

    await expect(
      projectData.validateSceneBeatSheet({
        homeDir,
        document: {
          ...valid,
          beats: [
            {
              ...valid.beats[0]!,
              id: 'beat_001_duplicate',
              screenplayBlockIndexes: [99],
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
      projectData.validateSceneBeatSheet({
        homeDir,
        document: {
          ...valid,
          beats: [{ ...valid.beats[0]!, castMemberIds: ['cast_missing'] }],
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
      projectData.validateSceneBeatSheet({
        homeDir,
        document: {
          ...valid,
          beats: [
            valid.beats[0]!,
            {
              ...valid.beats[0]!,
              title: 'Duplicate identifier',
              locationIds: ['location_missing'],
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('Duplicate Beat id'),
        }),
        expect.objectContaining({
          message: expect.stringContaining('unknown location'),
        }),
      ]),
    });
  });

  it('writes beat-sheet history, sets active, and preserves older rows', async () => {
    const ids = await sampleIds();
    const idGenerator = createDeterministicIdGenerator();
    const first = await projectData.writeSceneBeatSheet({
      homeDir,
      document: sampleBeatSheet(ids, 'First pass'),
      idGenerator,
    });
    const second = await projectData.writeSceneBeatSheet({
      homeDir,
      document: sampleBeatSheet(ids, 'Second pass'),
      idGenerator,
    });

    expect(first.beatSheet.id).not.toEqual(second.beatSheet.id);
    expect(second.activeBeatSheetId).toBe(second.beatSheet.id);

    const list = await projectData.listSceneBeatSheets({
      homeDir,
      sceneId: ids.sceneId,
    });
    expect(list.beatSheets.map((beatSheet) => beatSheet.id)).toEqual(
      expect.arrayContaining([first.beatSheet.id, second.beatSheet.id])
    );

    await projectData.setActiveSceneBeatSheet({
      homeDir,
      sceneId: ids.sceneId,
      beatSheetId: first.beatSheet.id,
    });

    await expect(
      projectData.readSceneBeatSheet({
        homeDir,
        active: true,
        sceneId: ids.sceneId,
      })
    ).resolves.toMatchObject({
      summary: { id: first.beatSheet.id },
      beatSheet: { title: 'First pass' },
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

function sampleBeatSheet(
  ids: { sceneId: string; castMemberId: string; locationId: string },
  title = 'Council chamber coverage',
  beatCount = 1
): SceneBeatSheetDocument {
  const baseBeat = {
    title: 'Map study',
    description:
      'Mehmed stands at the council table with the city map spread before him.',
    narrativeDevelopment: 'Mehmed studies the city map before the siege plan hardens.',
    narrativePurpose: 'Establish the strategic obsession driving the scene.',
    screenplayBlockIndexes: [0],
    castMemberIds: [ids.castMemberId],
    locationIds: [ids.locationId],
  };
  return {
    kind: 'sceneBeatSheet',
    sceneId: ids.sceneId,
    title,
    summary: 'The council scene progresses from study toward commitment.',
    narrativeProgression:
      'Private study becomes a public commitment to the siege.',
    lookbookInfluence: 'Use the established restrained council-chamber atmosphere.',
    beats: Array.from({ length: beatCount }, (_, index) => ({
      ...baseBeat,
      id: `beat_${String(index + 1).padStart(3, '0')}`,
      title: index === 0 ? baseBeat.title : `Map study alternate ${index + 1}`,
    })),
  };
}
