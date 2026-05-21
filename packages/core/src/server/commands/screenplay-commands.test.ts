import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ScreenplayDocument, ScreenplayOperationDocument } from '../../client/screenplay.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../index.js';
import {
  writeConfig,
  writeMinimalProjectSetup,
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
      suggestion: 'Run `renku project open <project-name>` before using screenplay commands.',
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
      expect.arrayContaining(['cast', 'location', 'act', 'sequence', 'scene', 'block'])
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
      } as unknown as ScreenplayDocument,
    });
    expect(valid.warnings).toEqual([
      expect.objectContaining({
        code: 'PROJECT_DATA214',
        location: expect.objectContaining({ path: ['mood'] }),
      }),
    ]);
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
            localKey: 'new-scene',
            title: 'Second Scene',
            setting: { locationRefs: [{ id: locationId }] },
            blocks: [],
          },
        },
      ],
    };
    const report = await projectData.applyScreenplayOperations({ homeDir, document: operations });

    expect(report).toMatchObject({
      valid: true,
      changes: [expect.objectContaining({ operation: 'scene.add' })],
      generatedIds: [expect.objectContaining({ kind: 'scene', localKey: 'new-scene' })],
    });
    await expect(projectData.readScreenplayStatus({ homeDir })).resolves.toMatchObject({
      counts: expect.objectContaining({ scenes: 2 }),
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
            localKey: 'act-one',
            title: 'Act I',
            sequences: [
              {
                localKey: 'commission',
                title: 'The Commission',
                scenes: [
                  {
                    localKey: 'opening',
                    title: 'Opening Scene',
                    setting: {
                      locationRefs: [{ localKey: 'foundry' }, { localKey: 'foundry' }],
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
              localKey: 'inserted',
              title: 'Inserted Scene',
              setting: { locationRefs: [] },
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

  async function createBlankProject(): Promise<void> {
    await projectData.createFromSetup({
      setupPath: await writeMinimalProjectSetup(homeDir),
      homeDir,
      idGenerator: createDeterministicIdGenerator(),
    });
  }
});

function minimalScreenplayDocument(): ScreenplayDocument {
  return {
    kind: 'screenplay',
    screenplay: {
      title: 'Urban Basilica',
      logline: 'A founder builds a weapon and a conscience.',
    },
    cast: [
      {
        localKey: 'urban',
        name: 'Urban',
        role: 'cannon founder',
      },
    ],
    locations: [
      {
        localKey: 'foundry',
        name: 'Foundry',
      },
    ],
    acts: [
      {
        localKey: 'act-one',
        title: 'Act I',
        sequences: [
          {
            localKey: 'commission',
            title: 'The Commission',
            scenes: [
              {
                localKey: 'urban-enters',
                title: 'Urban Enters The Foundry',
                setting: {
                  interiorExterior: 'INT',
                  timeOfDay: 'NIGHT',
                  locationRefs: [{ localKey: 'foundry' }],
                },
                storyFunction: ['Introduce Urban'],
                blocks: [
                  {
                    localKey: 'action-one',
                    type: 'action',
                    text: 'Urban studies the cracked bronze.',
                    castMemberRefs: [{ localKey: 'urban' }],
                    locationRefs: [{ localKey: 'foundry' }],
                  },
                  {
                    localKey: 'line-one',
                    type: 'dialogue',
                    castMemberRef: { localKey: 'urban' },
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
