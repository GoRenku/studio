import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  ScreenplayCreateDocument,
  ScreenplayDocument,
  ScreenplayOperationDocument,
} from '../../client/screenplay.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../index.js';
import {
  createBlankMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('screenplay JSON commands', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-screenplay-command-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
  });

  it('requires a current authoring project before screenplay authoring', async () => {
    await expect(
      projectData.readScreenplayStatus({ homeDir })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA202',
      suggestion:
        'Open an existing project with `renku project open <project-name>`, or create a new project with `renku create <project-name> --title <title>`.',
    });
  });

  it('creates and reads a screenplay document with generated ids and resolved relationships', async () => {
    await createBlankProject();
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });

    const report = await projectData.createScreenplay({
      homeDir,
      document: minimalScreenplayDocument(),
    });

    expect(report).toMatchObject({
      valid: true,
      project: { name: 'blank-movie' },
      changes: [{ operation: 'screenplay.create' }],
      resourceKeys: expect.arrayContaining(['screenplay']),
    });
    expect(report.generatedIds?.map((id) => id.kind)).toEqual(
      expect.arrayContaining(['act', 'sequence', 'scene'])
    );

    await expect(projectData.readScreenplayStatus({ homeDir })).resolves.toMatchObject({
      exists: true,
      counts: {
        castMembers: 1,
        locations: 1,
        acts: 1,
        sequences: 1,
        scenes: 1,
        blocks: 2,
      },
    });

    const read = await projectData.readScreenplay({ homeDir });
    const scene = read.screenplay?.acts[0]?.sequences[0]?.scenes[0];
    expect(scene?.setting.locationIds).toHaveLength(1);
    expect(scene?.blocks[0]).toMatchObject({
      type: 'action',
      castMemberIds: [read.screenplay?.cast[0]?.id],
      locationIds: [read.screenplay?.locations[0]?.id],
    });
    expect(scene?.blocks[1]).toMatchObject({
      type: 'dialogue',
      castMemberId: read.screenplay?.cast[0]?.id,
    });
  });

  it('rejects a second create and points callers to apply', async () => {
    await createBlankProject();
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });
    await projectData.createScreenplay({ homeDir, document: minimalScreenplayDocument() });

    await expect(
      projectData.createScreenplay({ homeDir, document: minimalScreenplayDocument() })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA204',
      suggestion: 'Use `renku screenplay apply` for revisions.',
    });
  });

  it('validates structural errors and unknown-field warnings without writing', async () => {
    await createBlankProject();
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });

    await expect(
      projectData.validateScreenplayJson({
        homeDir,
        document: {
          kind: 'screenplay',
          screenplay: { title: 'Broken' },
          cast: [],
          locations: [],
          acts: [{ title: 'Act without sequences' }],
        } as unknown as ScreenplayDocument,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA200',
      issues: [expect.objectContaining({ code: 'PROJECT_DATA206' })],
    });

    const valid = await projectData.validateScreenplayJson({
      homeDir,
      document: {
        ...minimalScreenplayDocument(),
        mood: 'extraneous',
      } as unknown as ScreenplayCreateDocument,
    });
    expect(valid.warnings).toEqual([
      expect.objectContaining({
        code: 'PROJECT_DATA214',
        location: expect.objectContaining({ path: ['mood'] }),
      }),
    ]);
  });

  it('rejects screenplay metadata arrays that are not strings', async () => {
    await createBlankProject();
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });

    await expect(
      projectData.validateScreenplayJson({
        homeDir,
        document: {
          ...minimalScreenplayDocument(),
          screenplay: {
            title: 'Urban Basilica',
            historicalBasis: [{ source: 'chronicle' }],
          },
        } as unknown as ScreenplayCreateDocument,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA200',
      issues: [expect.objectContaining({ code: 'PROJECT_DATA208' })],
    });
  });

  it('applies focused scene additions atomically', async () => {
    await createBlankProject();
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });
    await projectData.createScreenplay({ homeDir, document: minimalScreenplayDocument() });
    const current = await projectData.readScreenplay({ homeDir });
    const sequenceId = current.screenplay?.acts[0]?.sequences[0]?.id;
    const locationId = current.screenplay?.locations[0]?.id;
    if (!sequenceId || !locationId) {
      throw new Error('Expected seeded screenplay ids.');
    }

    const operations: ScreenplayOperationDocument = {
      kind: 'screenplayOperations',
      operations: [
        {
          operation: 'scene.add',
          sequenceId,
          scene: {
            key: 'new-scene',
            title: 'Second Scene',
            setting: { locationReferences: [{ id: locationId }] },
            blocks: [],
          },
        },
      ],
    };
    const report = await projectData.applyScreenplayOperations({ homeDir, document: operations });

    expect(report).toMatchObject({
      valid: true,
      changes: [expect.objectContaining({ operation: 'scene.add' })],
      generatedIds: [expect.objectContaining({ kind: 'scene', key: 'new-scene' })],
    });
    await expect(projectData.readScreenplayStatus({ homeDir })).resolves.toMatchObject({
      counts: expect.objectContaining({ scenes: 2 }),
    });
  });

  it('updates screenplay metadata without changing the screenplay graph', async () => {
    await createBlankProject();
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });
    await projectData.createScreenplay({ homeDir, document: minimalScreenplayDocument() });

    const current = await projectData.readScreenplay({ homeDir });
    const screenplay = current.screenplay?.screenplay;
    if (!screenplay) {
      throw new Error('Expected seeded screenplay ids.');
    }

    const report = await projectData.applyScreenplayOperations({
      homeDir,
      document: {
        kind: 'screenplayOperations',
        operations: [
          {
            operation: 'screenplay.update',
            screenplay: {
              ...screenplay,
              summary: 'Urban understands that craft can become consequence.',
            },
          },
        ],
      },
    });

    expect(report.changes).toEqual([{ operation: 'screenplay.update' }]);
    const updated = await projectData.readScreenplay({ homeDir });
    expect(updated.screenplay?.screenplay.summary).toBe(
      'Urban understands that craft can become consequence.'
    );
  });

  it('records screenplay revisions and restores a previous narrative version', async () => {
    await createBlankProject();
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });
    await projectData.createScreenplay({ homeDir, document: minimalScreenplayDocument() });
    const initialRevisions = await projectData.listScreenplayRevisions({ homeDir });
    expect(initialRevisions.revisions).toHaveLength(1);

    const current = await projectData.readScreenplay({ homeDir });
    const scene = current.screenplay?.acts[0]?.sequences[0]?.scenes[0];
    if (!scene?.id) {
      throw new Error('Expected seeded scene id.');
    }

    const revisedScene = {
      ...scene,
      title: 'Opening Scene Revised',
      blocks: [
        ...scene.blocks,
        {
          type: 'action' as const,
          text: 'Urban notices the metal has changed color overnight.',
          castMemberIds: [],
          locationIds: [],
        },
      ],
    };

    const dryRun = await projectData.reviseScreenplayScene({
      homeDir,
      sceneId: scene.id as string,
      document: { kind: 'screenplaySceneRevision', scene: revisedScene },
      dryRun: true,
    });
    expect(dryRun.warnings).toEqual([]);
    expect(dryRun.changes).toEqual([
      expect.objectContaining({ operation: 'scene.update' }),
    ]);
    await expect(projectData.readScreenplay({ homeDir })).resolves.toMatchObject({
      screenplay: {
        acts: [
          {
            sequences: [
              {
                scenes: [expect.objectContaining({ title: scene.title })],
              },
            ],
          },
        ],
      },
    });

    const reviseReport = await projectData.reviseScreenplayScene({
      homeDir,
      sceneId: scene.id as string,
      document: { kind: 'screenplaySceneRevision', scene: revisedScene },
    });
    expect(reviseReport.resourceKeys).toEqual(
      expect.arrayContaining(['screenplay', `scene:${String(scene.id)}`])
    );

    const afterRevise = await projectData.listScreenplayRevisions({ homeDir });
    expect(afterRevise.revisions).toHaveLength(2);
    const shown = await projectData.readScreenplayRevision({
      homeDir,
      revisionId: afterRevise.revisions[0]!.id,
    });
    expect(shown.screenplay.acts[0]?.sequences[0]?.scenes[0]?.title).toBe(
      'Opening Scene Revised'
    );

    const restore = await projectData.restoreScreenplayRevision({
      homeDir,
      revisionId: initialRevisions.revisions[0]!.id,
    });
    expect(restore.resourceKeys).toEqual(
      expect.arrayContaining(['screenplay', `scene:${String(scene.id)}`])
    );
    const restored = await projectData.readScreenplay({ homeDir });
    expect(restored.screenplay?.acts[0]?.sequences[0]?.scenes[0]?.title).toBe(
      scene.title
    );
    await expect(projectData.listScreenplayRevisions({ homeDir })).resolves.toMatchObject({
      revisions: expect.arrayContaining([
        expect.objectContaining({ sourceCommand: 'screenplay.revision.restore' }),
      ]),
    });
  });

  it('honors placement and warns when duplicate relationship refs are normalized', async () => {
    await createBlankProject();
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });
    const createReport = await projectData.createScreenplay({
      homeDir,
      document: {
        ...minimalScreenplayDocument(),
        acts: [
          {
            key: 'act-one',
            title: 'Act I',
            sequences: [
              {
                key: 'commission',
                title: 'The Commission',
                scenes: [
                  {
                    key: 'opening',
                    title: 'Opening Scene',
                    setting: {
                      locationIds: ['location_test0001', 'location_test0001'],
                    },
                    blocks: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(createReport.warnings).toEqual([
      expect.objectContaining({ code: 'PROJECT_DATA215' }),
    ]);

    const current = await projectData.readScreenplay({ homeDir });
    const sequence = current.screenplay?.acts[0]?.sequences[0];
    const firstSceneId = sequence?.scenes[0]?.id;
    if (!sequence?.id || !firstSceneId) {
      throw new Error('Expected seeded screenplay ids.');
    }

    await projectData.applyScreenplayOperations({
      homeDir,
      document: {
        kind: 'screenplayOperations',
        operations: [
          {
            operation: 'scene.add',
            sequenceId: sequence.id,
            placement: { beforeId: firstSceneId },
            scene: {
              key: 'inserted',
              title: 'Inserted Scene',
              setting: { locationReferences: [] },
              blocks: [],
            },
          },
        ],
      },
    });

    const reordered = await projectData.readScreenplay({ homeDir });
    expect(reordered.screenplay?.acts[0]?.sequences[0]?.scenes.map((scene) => scene.title)).toEqual([
      'Inserted Scene',
      'Opening Scene',
    ]);
  });

  it('warns when reusable cast or location names look duplicated', async () => {
    await createBlankProject();
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });

    const castReport = await projectData.applyCastOperations({
      homeDir,
      document: {
        kind: 'castOperations',
        operations: [
          {
            operation: 'castMember.add',
            castMember: { key: 'urban-voice', handle: 'urban-voice', name: 'Urban' },
          },
        ],
      },
    });
    const locationReport = await projectData.applyLocationOperations({
      homeDir,
      document: {
        kind: 'locationOperations',
        operations: [
          {
            operation: 'location.add',
            location: { key: 'foundry-night', handle: 'foundry-night', name: 'Foundry' },
          },
        ],
      },
    });

    expect(castReport.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PROJECT_DATA215',
        }),
      ])
    );
    expect(locationReport.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'PROJECT_DATA215',
        }),
      ])
    );
  });

  it('validates scene moves against declared parents and adjacent placement neighbors', async () => {
    await createBlankProject();
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });
    await projectData.createScreenplay({ homeDir, document: minimalScreenplayDocument() });

    const current = await projectData.readScreenplay({ homeDir });
    const actId = current.screenplay?.acts[0]?.id;
    const sequenceId = current.screenplay?.acts[0]?.sequences[0]?.id;
    const firstSceneId = current.screenplay?.acts[0]?.sequences[0]?.scenes[0]?.id;
    if (!actId || !sequenceId || !firstSceneId) {
      throw new Error('Expected seeded screenplay ids.');
    }

    await projectData.applyScreenplayOperations({
      homeDir,
      document: {
        kind: 'screenplayOperations',
        operations: [
          {
            operation: 'scene.add',
            sequenceId,
            scene: {
              key: 'second-scene',
              title: 'Second Scene',
              setting: {},
              blocks: [],
            },
          },
          {
            operation: 'scene.add',
            sequenceId,
            scene: {
              key: 'third-scene',
              title: 'Third Scene',
              setting: {},
              blocks: [],
            },
          },
          {
            operation: 'sequence.add',
            actId,
            sequence: {
              key: 'parallel-sequence',
              title: 'Parallel Sequence',
              scenes: [],
            },
          },
        ],
      },
    });

    const expanded = await projectData.readScreenplay({ homeDir });
    const mainSequence = expanded.screenplay?.acts[0]?.sequences[0];
    const otherSequenceId = expanded.screenplay?.acts[0]?.sequences[1]?.id;
    const secondSceneId = mainSequence?.scenes[1]?.id;
    const thirdSceneId = mainSequence?.scenes[2]?.id;
    if (!mainSequence?.id || !otherSequenceId || !secondSceneId || !thirdSceneId) {
      throw new Error('Expected expanded screenplay ids.');
    }

    await projectData.applyScreenplayOperations({
      homeDir,
      document: {
        kind: 'screenplayOperations',
        operations: [
          {
            operation: 'scene.move',
            sceneId: thirdSceneId,
            fromSequenceId: mainSequence.id,
            toSequenceId: mainSequence.id,
            placement: { afterId: firstSceneId, beforeId: secondSceneId },
          },
        ],
      },
    });
    const moved = await projectData.readScreenplay({ homeDir });
    expect(moved.screenplay?.acts[0]?.sequences[0]?.scenes.map((scene) => scene.title)).toEqual([
      'Urban Enters The Foundry',
      'Third Scene',
      'Second Scene',
    ]);

    await expect(
      projectData.applyScreenplayOperations({
        homeDir,
        document: {
          kind: 'screenplayOperations',
          operations: [
            {
              operation: 'scene.move',
              sceneId: thirdSceneId,
              fromSequenceId: otherSequenceId,
              toSequenceId: mainSequence.id,
              placement: { afterId: firstSceneId },
            },
          ],
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA212' });

    await expect(
      projectData.applyScreenplayOperations({
        homeDir,
        document: {
          kind: 'screenplayOperations',
          operations: [
            {
              operation: 'scene.move',
              sceneId: thirdSceneId,
              fromSequenceId: mainSequence.id,
              toSequenceId: mainSequence.id,
              placement: { afterId: secondSceneId, beforeId: firstSceneId },
            },
          ],
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA212' });
  });

  async function createBlankProject(): Promise<void> {
    const created = await createBlankMovieProject({
      projectData,
      homeDir,
    });
    if (!created) {
      return;
    }
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
  }
});

function minimalScreenplayDocument(): ScreenplayCreateDocument {
  return {
    kind: 'screenplayCreate',
    screenplay: {
      title: 'Urban Basilica',
      logline: 'A founder builds a weapon and a conscience.',
    },
    cast: [],
    locations: [],
    acts: [
      {
        key: 'act-one',
        title: 'Act I',
        sequences: [
          {
            key: 'commission',
            title: 'The Commission',
            scenes: [
              {
                key: 'urban-enters',
                title: 'Urban Enters The Foundry',
                setting: {
                  interiorExterior: 'INT',
                  timeOfDay: 'NIGHT',
                  locationIds: ['location_test0001'],
                },
                storyFunction: ['Introduce Urban'],
                blocks: [
                  {
                    type: 'action',
                    text: 'Urban studies the cracked bronze.',
                    castMemberIds: ['cast_test0001'],
                    locationIds: ['location_test0001'],
                  },
                  {
                    dialogueId: 'dialogue_urban_test',
                    type: 'dialogue',
                    castMemberId: 'cast_test0001',
                    lines: ['No furnace is innocent.'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}
