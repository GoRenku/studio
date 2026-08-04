import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  ScreenplayAnalysis,
  ScreenplayAnalysisCritique,
} from '../../client/screenplay-analysis/index.js';
import type { Screenplay, ScreenplayInput } from '../../client/screenplay/index.js';
import { createDeterministicIdGenerator, createProjectDataService } from '../index.js';
import { validateScreenplayAnalysis } from '../screenplay-analysis/validation.js';
import { createBlankMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('hierarchy-independent Screenplay Analysis', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-screenplay-analysis-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
  });

  it('validates analytical Acts and optional groups against flat canonical Scene order', () => {
    const screenplay = flatScreenplay();
    const result = validateScreenplayAnalysis({
      analysis: validAnalysis(),
      screenplay,
    });
    expect(result).toMatchObject({ valid: true, issues: [] });
  });

  it('does not read organization Sections when validating analytical structure', () => {
    const flat = flatScreenplay();
    const organized = structuredClone(flat);
    organized.sections = [
      { id: 'section_sequence', type: 'sequence', title: 'A non-analytical grouping' },
    ];
    organized.structure = [
      {
        id: 'entry_sequence',
        content: { type: 'section', sectionId: 'section_sequence' },
        position: 0,
      },
      ...flat.structure.map((entry, position) => ({
        ...entry,
        parentSectionId: 'section_sequence',
        position,
      })),
    ];

    expect(validateScreenplayAnalysis({ analysis: validAnalysis(), screenplay: flat }).valid).toBe(true);
    expect(validateScreenplayAnalysis({ analysis: validAnalysis(), screenplay: organized }).valid).toBe(true);
  });

  it('rejects incomplete Scene partitions, organizational fields, missing beats, bad scores, and unknown evidence Scenes', () => {
    const screenplay = flatScreenplay();

    const incomplete = validAnalysis();
    incomplete.actSegments[1]!.sceneIds = [];
    expect(validateScreenplayAnalysis({ analysis: incomplete, screenplay }).valid).toBe(false);

    const organizational = validAnalysis() as ScreenplayAnalysis & { acts?: unknown[] };
    organizational.acts = [];
    expect(validateScreenplayAnalysis({ analysis: organizational, screenplay }).valid).toBe(false);

    const missingBeat = validAnalysis();
    missingBeat.keyBeats = missingBeat.keyBeats.slice(0, 8);
    expect(validateScreenplayAnalysis({ analysis: missingBeat, screenplay }).valid).toBe(false);

    const badScore = validAnalysis();
    badScore.sceneAnalyses[0]!.scoreByCriterion.stakes = 101;
    expect(validateScreenplayAnalysis({ analysis: badScore, screenplay }).valid).toBe(false);

    const unknownEvidence = validAnalysis();
    unknownEvidence.sceneAnalyses[0]!.critique.evidence[0]!.sceneId = 'scene_missing';
    expect(validateScreenplayAnalysis({ analysis: unknownEvidence, screenplay }).valid).toBe(false);
  });

  it('persists immutable history, active selection, and the Scene-first Story Arc resource', async () => {
    const created = await createBlankMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }
    await projectData.createScreenplay({
      projectName: created.projectName,
      homeDir,
      screenplay: flatScreenplayInput(),
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.openCurrentProject({
      projectName: created.projectName,
      homeDir,
    });
    const screenplay = (await projectData.readScreenplayStructure({
      projectName: created.projectName,
      homeDir,
    })).screenplay;
    const sceneIds = screenplay.scenes.map((scene) => scene.id);
    const analysis = validAnalysis(sceneIds);

    const analysisIds = createDeterministicIdGenerator();
    const first = await projectData.writeScreenplayAnalysis({
      homeDir,
      analysis,
      idGenerator: analysisIds,
    });
    const secondAnalysis = structuredClone(analysis);
    secondAnalysis.title = 'Second analysis';
    const second = await projectData.writeScreenplayAnalysis({
      homeDir,
      analysis: secondAnalysis,
      idGenerator: analysisIds,
    });

    const history = await projectData.listScreenplayAnalyses({
      homeDir,
    });
    expect(history.analyses).toHaveLength(2);
    expect(history.activeAnalysisId).toBe(second.activeAnalysisId);

    await projectData.setActiveScreenplayAnalysis({
      homeDir,
      analysisId: first.activeAnalysisId,
    });
    const active = await projectData.readScreenplayAnalysis({
      homeDir,
      active: true,
    });
    expect(active.analysis?.title).toBe(analysis.title);

    const storyArc = await projectData.readStoryArcResource({
      projectName: created.projectName,
      homeDir,
    });
    expect(storyArc.scenes.map((scene) => scene.id)).toEqual(sceneIds);
    expect(storyArc.activeAnalysis?.actSegments.flatMap((segment) => segment.sceneIds)).toEqual(sceneIds);
    expect(storyArc).not.toHaveProperty('acts');

    await projectData.applyScreenplayOperations({
      projectName: created.projectName,
      homeDir,
      operations: [{ operation: 'scene.delete', scene: { id: sceneIds[0]! } }],
    });

    await expect(projectData.readScreenplayAnalysis({
      homeDir,
      analysisId: first.activeAnalysisId,
    })).resolves.toMatchObject({
      analysis: {
        actSegments: expect.arrayContaining([
          expect.objectContaining({ sceneIds: [sceneIds[0]] }),
        ]),
      },
    });
    await expect(projectData.listScreenplayAnalyses({ homeDir })).resolves.toMatchObject({
      analyses: expect.arrayContaining([
        expect.objectContaining({ id: first.activeAnalysisId }),
        expect.objectContaining({ id: second.activeAnalysisId }),
      ]),
    });
    await expect(projectData.readStoryArcResource({
      projectName: created.projectName,
      homeDir,
    })).resolves.toMatchObject({
      scenes: expect.not.arrayContaining([
        expect.objectContaining({ id: sceneIds[0] }),
      ]),
      activeAnalysis: {
        sceneAnalyses: expect.arrayContaining([
          expect.objectContaining({ sceneId: sceneIds[0] }),
        ]),
      },
    });
  });
});

const CRITERIA = [
  { key: 'dramaticEnergy', label: 'Dramatic Energy', description: 'How strongly the moment pulls the audience forward.' },
  { key: 'stakes', label: 'Stakes', description: 'How clearly the audience understands what can be lost or gained.' },
  { key: 'characterAgency', label: 'Character Agency', description: "How clearly a character's choice drives the story." },
];

function validAnalysis(sceneIds = ['scene_one', 'scene_two', 'scene_three']): ScreenplayAnalysis {
  const roles = ['hook', 'incitingIncident', 'firstPlotPoint', 'firstPinchPoint', 'midpoint', 'secondPinchPoint', 'secondPlotPoint', 'climax', 'resolution'] as const;
  return {
    structureModel: 'threeAct',
    title: 'Three-act evidence study',
    summary: 'The maker chooses power and faces the human cost of that choice.',
    criteria: CRITERIA,
    actSegments: [
      scoredAct('actOne', 'The offer', [sceneIds[0]!]),
      scoredAct('actTwo', 'The bargain', [sceneIds[1]!]),
      scoredAct('actThree', 'The consequence', [sceneIds[2]!]),
    ],
    keyBeats: roles.map((key, index) => ({
      key,
      label: key,
      sceneId: sceneIds[Math.min(Math.floor(index / 3), 2)],
      synopsis: `Evidence-backed ${key} beat.`,
      scoreByCriterion: scores(),
      critique: critique(sceneIds[Math.min(Math.floor(index / 3), 2)]!),
    })),
    sceneGroups: sceneIds.map((sceneId, index) => ({
      title: `Group ${index + 1}`,
      synopsis: `Scene group ${index + 1} follows one dramatic movement.`,
      sceneIds: [sceneId],
      scoreByCriterion: scores(),
      critique: critique(sceneId),
    })),
    sceneAnalyses: sceneIds.map((sceneId) => ({
      sceneId,
      synopsis: `Analysis for ${sceneId}.`,
      scoreByCriterion: scores(),
      critique: critique(sceneId),
    })),
    suggestedScenes: [{
      placement: { afterSceneId: sceneIds[0]! },
      title: 'A harder choice',
      purpose: 'Clarify that the maker rejects a viable alternative.',
      synopsis: 'A safe commission is offered and consciously refused.',
      rationale: 'The added decision makes later responsibility legible.',
      expectedCriterionChanges: [{
        criterionKey: 'characterAgency',
        direction: 'increase',
        reason: 'The protagonist makes the decisive compromise on screen.',
      }],
    }],
  };
}

function scoredAct(
  role: 'actOne' | 'actTwo' | 'actThree',
  title: string,
  sceneIds: string[],
) {
  return {
    role,
    title,
    synopsis: `${title} advances the central dramatic question.`,
    sceneIds,
    scoreByCriterion: scores(),
    critique: critique(sceneIds[0]!),
  };
}

function scores(): Record<string, number> {
  return { dramaticEnergy: 75, stakes: 80, characterAgency: 70 };
}

function critique(sceneId: string): ScreenplayAnalysisCritique {
  return {
    summary: 'The scene has a clear dramatic turn.',
    strengths: ['The choice is visible in action.'],
    concerns: ['The consequence can arrive sooner.'],
    evidence: [{ sceneId, text: 'A concrete Scene detail supports this reading.' }],
    suggestions: ['Make the next decision more costly.'],
  };
}

function flatScreenplay(): Screenplay {
  return {
    opening: [{ id: 'opening_one', type: 'titleCard', text: 'BASILICA' }],
    scenes: ['one', 'two', 'three'].map((suffix) => ({
      id: `scene_${suffix}`,
      productionNumber: suffix,
      heading: `EXT. TEST FIELD ${suffix.toUpperCase()} - DAY`,
      blocks: [{ id: `block_${suffix}`, type: 'action' as const, text: `Action ${suffix}.` }],
    })),
    sections: [],
    structure: ['one', 'two', 'three'].map((suffix, position) => ({
      id: `entry_${suffix}`,
      content: { type: 'scene' as const, sceneId: `scene_${suffix}` },
      position,
    })),
    references: [],
  };
}

function flatScreenplayInput(): ScreenplayInput {
  return {
    opening: [{ key: 'opening-one', type: 'titleCard', text: 'BASILICA' }],
    scenes: ['one', 'two', 'three'].map((suffix) => ({
      key: `scene-${suffix}`,
      productionNumber: suffix,
      heading: `EXT. TEST FIELD ${suffix.toUpperCase()} - DAY`,
      blocks: [{ key: `block-${suffix}`, type: 'action' as const, text: `Action ${suffix}.` }],
    })),
    sections: [],
    structure: ['one', 'two', 'three'].map((suffix, position) => ({
      key: `entry-${suffix}`,
      content: { type: 'scene' as const, scene: { key: `scene-${suffix}` } },
      position,
    })),
    references: [],
  };
}
