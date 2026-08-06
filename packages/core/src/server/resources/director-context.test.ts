import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneBeatSheetDocument } from '../../client/scene-beats/index.js';
import { createProjectDataService } from '../index.js';
import {
  createBlankMovieProject,
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('readDirectorContext', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-director-context-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
  });

  it('recommends screenplay drafting when the current project has no screenplay', async () => {
    const created = await createBlankMovieProject({
      projectData,
      homeDir,
      projectName: 'blank-director-movie',
      title: 'Blank Director Movie',
    });
    if (!created) {
      return;
    }
    await projectData.openCurrentProject({
      projectName: 'blank-director-movie',
      homeDir,
    });

    const report = await projectData.readDirectorContext({ homeDir });

    expect(report.screenplay.exists).toBe(false);
    expect(report.projectSettings).toMatchObject({
      version: 1,
      screenplayImport: { createContinuitySubjects: true },
    });
    expect(report.resourceKeys).toContain('project-settings');
    expect(report.nextSteps.map((step) => step.id)).toEqual(['draft-screenplay']);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DIRECTOR_CONTEXT002' }),
      ])
    );
  });

  it('recommends beat-sheet design for a selected scene without an active Beat Sheet', async () => {
    const sceneId = await createSampleProjectAndReadSceneId();
    if (!sceneId) {
      return;
    }

    const report = await projectData.readDirectorContext({
      homeDir,
      selection: { type: 'scene', id: sceneId },
    });

    expect(report.currentSelection).toMatchObject({
      valid: true,
      selection: { type: 'scene', id: sceneId },
    });
    expect(report.selectedScene).toMatchObject({
      sceneId,
      activeBeatSheetId: null,
    });
    expect(report.nextSteps.map((step) => step.id)).toContain('design-beat-sheet');
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DIRECTOR_CONTEXT007' }),
      ])
    );
  });

  it('recommends storyboard generation when the selected scene Beat Sheet has missing images', async () => {
    const scene = await createSampleProjectAndReadScene();
    if (!scene) {
      return;
    }
    await projectData.writeSceneBeatSheet({
      homeDir,
      document: sampleBeatSheet({
        sceneId: scene.sceneId,
        castMemberId: scene.castMemberId,
        locationId: scene.locationId,
        blockId: scene.blockId,
      }),
    });

    const report = await projectData.readDirectorContext({
      homeDir,
      selection: { type: 'scene', id: scene.sceneId },
    });

    expect(report.selectedScene).toMatchObject({
      sceneId: scene.sceneId,
      activeBeatSheetId: expect.any(String),
      storyboardStatus: {
        available: true,
        missingBeatIds: ['beat_001'],
      },
    });
    expect(report.nextSteps.map((step) => step.id)).toContain(
      'generate-storyboards'
    );
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DIRECTOR_CONTEXT008' }),
      ])
    );
  });

  it('reports Lookbook readiness from the two authored project roles', async () => {
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const production = await projectData.writeProductionLookbook({
      homeDir,
      document: productionLookbookDocument(),
    });
    const storyboard = await projectData.writeStoryboardLookbook({
      homeDir,
      document: storyboardLookbookDocument(),
    });

    const report = await projectData.readDirectorContext({ homeDir });

    expect(report.visualLanguage).toMatchObject({
      productionLookbookId: production.lookbook.id,
      storyboardLookbookId: storyboard.lookbook.id,
    });
    expect(report.diagnostics.map((issue) => issue.code)).not.toContain(
      'DIRECTOR_CONTEXT004'
    );
    expect(report.diagnostics.map((issue) => issue.code)).not.toContain(
      'DIRECTOR_CONTEXT013'
    );
  });

  it('reports missing Prop Sheets independently from Location Sheet readiness', async () => {
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({ projectName: 'constantinople', homeDir });
    const propReport = await projectData.applyPropOperations({
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
    const propId = propReport.generatedIds?.[0]?.id as string;
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(
      path.join(created.projectPath, 'tmp', 'location-sheet.png'),
      'image'
    );
    for (const location of await projectData.listLocations({ homeDir })) {
      await projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'location.sheet',
        target: { kind: 'location', id: location.id as string },
        sourceProjectRelativePath: 'tmp/location-sheet.png',
      });
    }

    const report = await projectData.readDirectorContext({ homeDir });

    expect(report.productionDesign).toMatchObject({
      everyLocationHasEnvironmentSheet: true,
      everyPropHasPropSheet: false,
      missingEnvironmentSheetLocationIds: [],
      missingPropSheetPropIds: [propId],
    });
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'DIRECTOR_CONTEXT014',
          location: expect.objectContaining({
            path: ['productionDesign', 'missingPropSheetPropIds'],
          }),
        }),
      ])
    );
    expect(report.diagnostics.map((issue) => issue.code)).not.toContain(
      'DIRECTOR_CONTEXT006'
    );
    expect(report.nextSteps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'design-props',
          command:
            'renku generation context --purpose prop.sheet --target prop:<prop-id> --json',
        }),
      ])
    );
    expect(report.nextSteps.map((step) => step.id)).not.toContain(
      'design-production'
    );
  });

  async function createSampleProjectAndReadSceneId(): Promise<string | null> {
    return (await createSampleProjectAndReadScene())?.sceneId ?? null;
  }

  async function createSampleProjectAndReadScene(): Promise<{
    sceneId: string;
    castMemberId: string;
    locationId: string;
    blockId: string;
  } | null> {
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return null;
    }
    const screenplay = await projectData.readScreenplayStructure({ projectName: 'constantinople', homeDir });
    const scene = screenplay.screenplay.scenes[0]!;
    const cast = await projectData.listCastMembers({ homeDir });
    const locations = await projectData.listLocations({ homeDir });
    return {
      sceneId: scene.id,
      castMemberId: cast[1]!.id,
      locationId: locations[0]!.id,
      blockId: scene.blocks[0]!.id,
    };
  }
});

function productionLookbookDocument() {
  return {
    kind: 'productionLookbook' as const,
    productionLookbook: {
      name: 'Production Language',
      thesis: { statement: 'Held monumental frames.', principles: ['Keep scale legible.'] },
      palette: {
        description: 'Stone and ember.',
        colors: [{ hex: '#8A6437', name: 'Worked bronze', meaning: 'Engineered force.' }],
        observations: [],
      },
      toneMood: { tone: 'severe', moodTags: ['monumental'], description: 'Restrained pressure.' },
      composition: {
        description: 'Stable axes.',
        patterns: [{ name: 'Held center', description: 'Keep mass legible.' }],
      },
      lighting: {
        description: 'Low sun and fire.',
        patterns: [{ name: 'Ember edge', description: 'Use fire as a narrow accent.' }],
      },
      texture: { description: 'Stone and smoke.', observations: [] },
      camera: {
        description: 'Measured movement.',
        movement: [{ name: 'Slow push', description: 'Move only as decisions harden.' }],
        motion: [{ name: 'Held weight', description: 'Let labor remain deliberate.' }],
        framing: [{ name: 'Human scale', description: 'Keep bodies small against masonry.' }],
      },
    },
    sourceInspirationFolderIds: [],
  };
}

function storyboardLookbookDocument() {
  return {
    kind: 'storyboardLookbook' as const,
    storyboardLookbook: {
      name: 'Storyboard Language',
      styleBrief: { text: 'Loose graphite frames.' },
      lineAndFinish: { text: 'Visible construction lines.' },
      valueAndAccent: { text: 'Gray wash with ochre accents.' },
      guardrails: { text: 'Avoid final-film polish.' },
    },
    sourceInspirationFolderIds: [],
  };
}

function sampleBeatSheet(ids: {
  sceneId: string;
  castMemberId: string;
  locationId: string;
  blockId: string;
}): SceneBeatSheetDocument {
  return {
    sceneId: ids.sceneId,
    title: 'Council chamber coverage',
    summary: 'A restrained coverage plan for the first scene.',
    narrativeProgression: 'Hold the map table and Mehmed in one composed frame.',
    beats: [
      {
        id: 'beat_001',
        title: 'Map study',
        description:
          'Mehmed stands at the council table with the city map spread before him.',
        narrativeDevelopment: 'Mehmed studies the city map before the siege plan hardens.',
        narrativePurpose: 'Establish the strategic obsession driving the scene.',
        screenplayBlockIds: [ids.blockId],
        castMemberIds: [ids.castMemberId],
        locationIds: [ids.locationId],
        propIds: [],
      },
    ],
  };
}
