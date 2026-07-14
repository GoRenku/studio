import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneShotListDocument } from '../../client/scene-shot-list.js';
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
    expect(report.nextSteps.map((step) => step.id)).toEqual(['draft-screenplay']);
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DIRECTOR_CONTEXT002' }),
      ])
    );
  });

  it('recommends shot-list design for a selected scene without an active shot list', async () => {
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
      activeShotListId: null,
    });
    expect(report.nextSteps.map((step) => step.id)).toContain('design-shot-list');
    expect(report.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DIRECTOR_CONTEXT007' }),
      ])
    );
  });

  it('recommends storyboard generation when the selected scene shot list has missing images', async () => {
    const scene = await createSampleProjectAndReadScene();
    if (!scene) {
      return;
    }
    await projectData.writeSceneShotList({
      homeDir,
      document: sampleShotList({
        sceneId: scene.sceneId,
        castMemberId: scene.castMemberId,
        locationId: scene.locationId,
      }),
    });

    const report = await projectData.readDirectorContext({
      homeDir,
      selection: { type: 'scene', id: scene.sceneId },
    });

    expect(report.selectedScene).toMatchObject({
      sceneId: scene.sceneId,
      activeShotListId: expect.any(String),
      storyboardStatus: {
        available: true,
        missingShotIds: ['shot_001'],
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

  async function createSampleProjectAndReadSceneId(): Promise<string | null> {
    return (await createSampleProjectAndReadScene())?.sceneId ?? null;
  }

  async function createSampleProjectAndReadScene(): Promise<{
    sceneId: string;
    castMemberId: string;
    locationId: string;
  } | null> {
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return null;
    }
    const screenplay = await projectData.readScreenplay({ homeDir });
    const act = screenplay.screenplay!.acts[0]!;
    const sequence = act.sequences[0]!;
    const scene = sequence.scenes[0]!;
    return {
      sceneId: scene.id as string,
      castMemberId: screenplay.screenplay!.cast[1]!.id as string,
      locationId: screenplay.screenplay!.locations[0]!.id as string,
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

function sampleShotList(ids: {
  sceneId: string;
  castMemberId: string;
  locationId: string;
}): SceneShotListDocument {
  return {
    kind: 'sceneShotList',
    sceneId: ids.sceneId,
    title: 'Council chamber coverage',
    summary: 'A restrained coverage plan for the first scene.',
    coverageStrategy: 'Hold the map table and Mehmed in one composed frame.',
    shots: [
      {
        shotId: 'shot_001',
        title: 'Map study',
        storyBeat: 'Mehmed studies the city map before the siege plan hardens.',
        narrativePurpose: 'Establish the strategic obsession driving the scene.',
        description: 'Wide static shot of Mehmed at the table with the map.',
        shotType: 'wide',
        subject: 'Mehmed and the city map',
        action: 'Mehmed studies the map in silence.',
        dialogue: [],
        coveredBlockIndexes: [0],
        castMemberIds: [ids.castMemberId],
        locationIds: [ids.locationId],
      },
    ],
  };
}
