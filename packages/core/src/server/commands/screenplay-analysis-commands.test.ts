import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  ScreenplayAnalysisDocument,
  ScreenplayAnalysisWriteReport,
} from '../../client/screenplay-analysis.js';
import type { ScreenplayCreateDocument } from '../../client/screenplay.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../index.js';
import {
  createBlankMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('screenplay analysis commands', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-screenplay-analysis-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createBlankMovieProject({ projectData, homeDir });
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });
    await projectData.applyCastOperations({
      homeDir,
      document: {
        kind: 'castOperations',
        operations: [
          {
            operation: 'castMember.add',
            castMember: {
              key: 'urban',
              handle: 'urban',
              name: 'Urban',
              role: 'cannon founder',
            },
          },
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.applyLocationOperations({
      homeDir,
      document: {
        kind: 'locationOperations',
        operations: [
          {
            operation: 'location.add',
            location: {
              key: 'foundry',
              handle: 'foundry',
              name: 'Foundry',
            },
          },
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.createScreenplay({
      homeDir,
      document: threeActScreenplayDocument(),
    });
  });

  it('returns analysis context with default criteria and no active analysis', async () => {
    const context = await projectData.readScreenplayAnalysisContext({ homeDir });

    expect(context.valid).toBe(true);
    expect(context.screenplay.title).toBe('Urban Basilica');
    expect(context.screenplay.acts[0]?.sequences[0]?.scenes[0]?.title).toBe(
      'The Refusal'
    );
    expect(context.defaultCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'dramaticEnergy' }),
        expect.objectContaining({ key: 'stakes' }),
        expect.objectContaining({ key: 'characterAgency' }),
      ])
    );
    expect(context.activeAnalysis).toBeNull();
    expect(context.resourceKeys).toEqual(
      expect.arrayContaining(['surface:story-arc', 'screenplay-analysis'])
    );
  });

  it('validates a three-act analysis document and accepts additional criteria', async () => {
    const analysis = await analysisDocument();

    await expect(
      projectData.validateScreenplayAnalysis({
        homeDir,
        document: {
          ...analysis,
          criteria: [
            ...analysis.criteria,
            {
              key: 'moralPressure',
              label: 'Moral Pressure',
              description: 'How forcefully the scene confronts responsibility.',
            },
          ],
          scenes: analysis.scenes.map((scene) => ({
            ...scene,
            scoreByCriterion: {
              ...scene.scoreByCriterion,
              moralPressure: 80,
            },
          })),
        },
      })
    ).resolves.toMatchObject({ valid: true, analysis: { kind: 'screenplayAnalysis' } });
  });

  it('rejects missing required fields and unknown fields with structured diagnostics', async () => {
    const analysis = await analysisDocument();

    await expect(
      projectData.validateScreenplayAnalysis({
        homeDir,
        document: {
          ...analysis,
          summary: undefined,
        } as unknown as ScreenplayAnalysisDocument,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA260',
      issues: [expect.objectContaining({ code: 'PROJECT_DATA260' })],
    });

    await expect(
      projectData.validateScreenplayAnalysis({
        homeDir,
        document: {
          ...analysis,
          timing: 'not part of this app',
        } as unknown as ScreenplayAnalysisDocument,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA260',
      issues: [
        expect.objectContaining({
          message: expect.stringContaining('Unknown field'),
        }),
      ],
    });
  });

  it('rejects invalid criteria and scores', async () => {
    const analysis = await analysisDocument();

    await expect(
      projectData.validateScreenplayAnalysis({
        homeDir,
        document: {
          ...analysis,
          criteria: analysis.criteria.filter((criterion) => criterion.key !== 'stakes'),
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA260',
      issues: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('stakes') }),
      ]),
    });

    await expect(
      projectData.validateScreenplayAnalysis({
        homeDir,
        document: {
          ...analysis,
          criteria: [...analysis.criteria, analysis.criteria[0]!],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('Duplicate') }),
      ]),
    });

    await expect(
      projectData.validateScreenplayAnalysis({
        homeDir,
        document: {
          ...analysis,
          scenes: [
            {
              ...analysis.scenes[0]!,
              scoreByCriterion: {
                dramaticEnergy: 101,
                stakes: 50,
                characterAgency: 50,
                undeclared: 20,
              },
            },
            ...analysis.scenes.slice(1),
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('Invalid value') }),
      ]),
    });

    await expect(
      projectData.validateScreenplayAnalysis({
        homeDir,
        document: {
          ...analysis,
          scenes: [
            {
              ...analysis.scenes[0]!,
              scoreByCriterion: {
                dramaticEnergy: 60,
                stakes: 50,
                characterAgency: 50,
                undeclared: 20,
              },
            },
            ...analysis.scenes.slice(1),
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('undeclared') }),
      ]),
    });
  });

  it('rejects unknown and mismatched screenplay references', async () => {
    const analysis = await analysisDocument();

    await expect(
      projectData.validateScreenplayAnalysis({
        homeDir,
        document: {
          ...analysis,
          acts: [
            { ...analysis.acts[0]!, actId: 'act_missing' },
            ...analysis.acts.slice(1),
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('order') }),
      ]),
    });

    await expect(
      projectData.validateScreenplayAnalysis({
        homeDir,
        document: {
          ...analysis,
          sequences: [
            {
              ...analysis.sequences[0]!,
              actId: analysis.acts[1]!.actId,
            },
            ...analysis.sequences.slice(1),
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('Sequence does not belong') }),
      ]),
    });

    await expect(
      projectData.validateScreenplayAnalysis({
        homeDir,
        document: {
          ...analysis,
          scenes: [
            {
              ...analysis.scenes[0]!,
              sequenceId: analysis.sequences[1]!.sequenceId,
            },
            ...analysis.scenes.slice(1),
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('Scene does not belong') }),
      ]),
    });

    await expect(
      projectData.validateScreenplayAnalysis({
        homeDir,
        document: {
          ...analysis,
          acts: [
            {
              ...analysis.acts[0]!,
              critique: {
                ...analysis.acts[0]!.critique,
                evidence: [
                  {
                    sceneId: 'scene_missing',
                    text: 'The evidence cites a scene id that is not in the screenplay.',
                  },
                ],
              },
            },
            ...analysis.acts.slice(1),
          ],
        },
      })
    ).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringContaining('unknown scene') }),
      ]),
    });
  });

  it('validates suggested scene additions without creating scene rows', async () => {
    const analysis = await analysisDocument();
    const statusBefore = await projectData.readScreenplayStatus({ homeDir });

    await expect(
      projectData.validateScreenplayAnalysis({ homeDir, document: analysis })
    ).resolves.toMatchObject({ valid: true });

    await expect(projectData.readScreenplayStatus({ homeDir })).resolves.toMatchObject({
      counts: { scenes: statusBefore.counts.scenes },
    });
  });

  it('writes history rows, sets active, and preserves older analyses', async () => {
    const first = await writeAnalysis('First pass');
    const second = await writeAnalysis('Second pass');

    expect(first.analysis.id).not.toEqual(second.analysis.id);
    expect(second.activeAnalysisId).toBe(second.analysis.id);

    const list = await projectData.listScreenplayAnalyses({ homeDir });
    expect(list.analyses.map((analysis) => analysis.id)).toEqual(
      expect.arrayContaining([first.analysis.id, second.analysis.id])
    );
    expect(list.activeAnalysisId).toBe(second.analysis.id);

    const active = await projectData.readScreenplayAnalysis({
      homeDir,
      active: true,
    });
    expect(active.summary?.id).toBe(second.analysis.id);

    await projectData.setActiveScreenplayAnalysis({
      homeDir,
      analysisId: first.analysis.id,
    });

    await expect(projectData.readScreenplayAnalysis({ homeDir, active: true })).resolves.toMatchObject({
      summary: { id: first.analysis.id },
    });
  });

  it('returns null when no active analysis exists', async () => {
    await expect(
      projectData.readScreenplayAnalysis({ homeDir, active: true })
    ).resolves.toMatchObject({
      analysis: null,
      summary: null,
      activeAnalysisId: null,
    });
  });

  it('returns ordered scenes and active analysis in the Story Arc resource', async () => {
    await writeAnalysis('Story Arc pass');

    const resource = await projectData.readStoryArcResource({
      homeDir,
      projectName: 'blank-movie',
    });

    expect(resource.screenplay.title).toBe('Urban Basilica');
    expect(resource.acts[0]?.sequences[0]?.scenes[0]).toMatchObject({
      title: 'The Refusal',
      storyFunction: ['Pressure Urban'],
    });
    expect(resource.activeAnalysis).toMatchObject({
      kind: 'screenplayAnalysis',
      title: 'Story Arc pass',
      scenes: expect.arrayContaining([
        expect.objectContaining({
          title: 'The Refusal',
          scoreByCriterion: {
            dramaticEnergy: 64,
            stakes: 59,
            characterAgency: 51,
          },
        }),
      ]),
    });
  });

  async function writeAnalysis(title: string): Promise<ScreenplayAnalysisWriteReport> {
    const analysis = await analysisDocument();
    return await projectData.writeScreenplayAnalysis({
      homeDir,
      document: { ...analysis, title },
    });
  }

  async function analysisDocument(): Promise<ScreenplayAnalysisDocument> {
    const context = await projectData.readScreenplayAnalysisContext({ homeDir });
    const acts = context.screenplay.acts;
    const sequences = acts.map((act) => act.sequences[0]!);
    const scenes = sequences.map((sequence) => sequence.scenes[0]!);
    return {
      kind: 'screenplayAnalysis',
      structureModel: 'threeAct',
      title: 'Three-act screenplay analysis',
      summary:
        'Urban has a clear moral engine, but the opening can sharpen agency.',
      criteria: [
        {
          key: 'dramaticEnergy',
          label: 'Dramatic Energy',
          description: 'How strongly the moment pulls the audience forward.',
        },
        {
          key: 'stakes',
          label: 'Stakes',
          description:
            'How clearly the audience understands what can be lost or gained.',
        },
        {
          key: 'characterAgency',
          label: 'Character Agency',
          description: "How clearly a character's choice drives the story.",
        },
      ],
      acts: acts.map((act, index) => ({
        actId: act.id,
        actRole: ['actOne', 'actTwo', 'actThree'][index] as
          | 'actOne'
          | 'actTwo'
          | 'actThree',
        title: act.title ?? `Act ${index + 1}`,
        synopsis:
          'The act presents a clear pressure pattern and a moral consequence.',
        scoreByCriterion: {
          dramaticEnergy: 60 + index,
          stakes: 55 + index,
          characterAgency: 50 + index,
        },
        critique: usefulCritique(scenes[index]!.id),
      })),
      keyBeats: [
        {
          key: 'hook',
          label: 'Hook',
          actId: acts[0]!.id,
          sequenceId: sequences[0]!.id,
          sceneId: scenes[0]!.id,
          synopsis: 'The story opens with the cost of Urban refusing limits.',
          scoreByCriterion: {
            dramaticEnergy: 70,
            stakes: 65,
            characterAgency: 55,
          },
          critique: usefulCritique(scenes[0]!.id),
        },
      ],
      sequences: sequences.map((sequence, index) => ({
        sequenceId: sequence.id,
        actId: acts[index]!.id,
        title: sequence.title ?? `Sequence ${index + 1}`,
        synopsis: 'The sequence advances the pressure on Urban.',
        beatRole: index === 0 ? 'hook' : undefined,
        scoreByCriterion: {
          dramaticEnergy: 60,
          stakes: 58,
          characterAgency: 53,
        },
        critique: usefulCritique(scenes[index]!.id),
      })),
      scenes: scenes.map((scene, index) => ({
        sceneId: scene.id,
        sequenceId: sequences[index]!.id,
        actId: acts[index]!.id,
        title: scene.title,
        synopsis: 'The scene shows Urban under pressure.',
        beatRole: index === 0 ? 'hook' : undefined,
        scoreByCriterion: {
          dramaticEnergy: 64,
          stakes: 59,
          characterAgency: 51,
        },
        critique: usefulCritique(scene.id),
      })),
      suggestedSceneAdditions: [
        {
          targetActId: acts[0]!.id,
          targetSequenceId: sequences[0]!.id,
          placement: { afterSceneId: scenes[0]!.id },
          title: 'The Maker Calculates',
          purpose: 'Give Urban a clearer active choice after the hook.',
          synopsis:
            'Urban privately weighs whether his craft can survive without patronage.',
          rationale:
            'The added beat would make the hook personal instead of only situational.',
          expectedCriterionChanges: [
            {
              criterionKey: 'characterAgency',
              direction: 'increase',
              reason: 'The audience sees Urban choose pressure.',
            },
          ],
        },
      ],
    };
  }
});

function usefulCritique(sceneId: string) {
  return {
    summary: 'The dramatic pressure is clear, but the choice can be sharper.',
    strengths: ['The scene gives the audience concrete pressure.'],
    concerns: ['Urban reacts before the audience fully sees his want.'],
    evidence: [
      {
        sceneId,
        text: 'The scene emphasizes pressure before a fully active decision.',
      },
    ],
    suggestions: ['Make the decision point more visible on the page.'],
  };
}

function threeActScreenplayDocument(): ScreenplayCreateDocument {
  return {
    kind: 'screenplayCreate',
    screenplay: {
      title: 'Urban Basilica',
      logline: 'A founder builds a weapon and a conscience.',
      summary: 'Urban sells his craft and must face what it makes possible.',
      dramaticQuestion: 'Can Urban understand responsibility before the walls fall?',
      themes: ['craft and complicity'],
      tone: ['grave', 'precise'],
      genrePrimary: 'historical drama',
    },
    cast: [],
    locations: [],
    acts: [
      screenplayAct('act-one', 'The Offer', 'commission', 'The Refusal'),
      screenplayAct('act-two', 'The Patron', 'casting', 'The Bargain'),
      screenplayAct('act-three', 'The Sound', 'siege', 'The Wall Answers'),
    ],
  };
}

function screenplayAct(
  actKey: string,
  actTitle: string,
  sequenceKey: string,
  sceneTitle: string
): ScreenplayCreateDocument['acts'][number] {
  return {
    key: actKey,
    title: actTitle,
    purpose: 'Move Urban through the moral cost of his craft.',
    sequences: [
      {
        key: sequenceKey,
        title: sceneTitle,
        purpose: 'Pressure Urban toward a choice.',
        scenes: [
          {
            key: `${sequenceKey}-scene`,
            title: sceneTitle,
            setting: {
              interiorExterior: 'INT',
              timeOfDay: 'NIGHT',
              locationIds: ['location_test0001'],
            },
            storyFunction: ['Pressure Urban'],
            blocks: [
              {
                type: 'action',
                text: 'Urban studies the cracked bronze and hears the city waiting.',
                castMemberIds: ['cast_test0001'],
                locationIds: ['location_test0001'],
              },
            ],
          },
        ],
      },
    ],
  };
}
