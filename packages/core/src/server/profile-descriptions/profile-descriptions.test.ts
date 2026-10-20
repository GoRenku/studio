import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../index.js';
import { openCurrentProject } from '../project-selection/index.js';
import { createBlankMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('sectioned profile descriptions', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-profile-description-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createBlankMovieProject({ homeDir, projectData });
    await openCurrentProject({ projectName: 'blank-movie', homeDir });
  });

  it('stores and reads back each subject description by section', async () => {
    const castMemberId = await addCastMember({
      appearance: 'A slender girl clad in leather.',
      behavior: 'Alert and agile.\n\nShe bandages the creature.',
      sourceNotes: 'Scenes 1–14.',
    });
    await expect(projectData.readCastMember({ homeDir, castMemberId })).resolves.toMatchObject({
      description: {
        appearance: 'A slender girl clad in leather.',
        behavior: 'Alert and agile.\n\nShe bandages the creature.',
        sourceNotes: 'Scenes 1–14.',
      },
    });

    const locationReport = await projectData.applyLocationOperations({
      homeDir,
      document: {
        kind: 'locationOperations',
        operations: [{
          operation: 'location.add',
          location: {
            key: 'lair',
            handle: 'lair',
            name: 'Dragon Lair',
            description: { storyUse: 'The climax.', spaceAndLayout: 'A nest in the far corner.' },
          },
        }],
      },
    });
    const locationId = locationReport.generatedIds?.[0]?.id as string;
    await expect(projectData.readLocation({ homeDir, locationId })).resolves.toMatchObject({
      description: { storyUse: 'The climax.', spaceAndLayout: 'A nest in the far corner.' },
    });

    const propReport = await projectData.applyPropOperations({
      homeDir,
      document: {
        kind: 'propOperations',
        operations: [{
          operation: 'prop.add',
          prop: {
            key: 'spear',
            handle: 'spear',
            name: 'Spear',
            description: { formAndMaterials: 'Spiked head.' },
          },
        }],
      },
    });
    const propId = propReport.generatedIds?.[0]?.id as string;
    await expect(projectData.readProp({ homeDir, propId })).resolves.toMatchObject({
      description: { formAndMaterials: 'Spiked head.' },
    });
  });

  it('rejects a section key that does not belong to the subject, with its location', async () => {
    await expect(addCastMember({ storyUse: 'Locations only.' } as never)).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'PROJECT_DATA214',
          location: expect.objectContaining({
            path: ['operations', '0', 'castMember', 'description', 'storyUse'],
          }),
        }),
      ]),
    });
  });

  it.each([
    ['an empty description object', {}],
    ['a whitespace-only section', { overview: '  \n ' }],
    ['a non-string section', { overview: 3 }],
  ])('rejects %s', async (_label, description) => {
    await expect(addCastMember(description as never)).rejects.toMatchObject({
      code: 'PROJECT_DATA200',
    });
    expect(await projectData.listCastMembers({ homeDir })).toHaveLength(0);
  });

  it('fails fast when a stored description does not match the contract', async () => {
    const castMemberId = await addCastMember({ overview: 'Valid at write time.' });
    const sqlite = new Database(path.join(homeDir, 'projects', 'blank-movie', '.renku', 'project.sqlite'));
    try {
      sqlite.prepare('update cast_member set description = ? where id = ?').run('plain legacy text', castMemberId);
    } finally {
      sqlite.close();
    }

    await expect(projectData.readCastMember({ homeDir, castMemberId })).rejects.toMatchObject({
      code: 'PROFILE_DESCRIPTION_STORED_INVALID',
    });
  });

  async function addCastMember(description: Record<string, string>): Promise<string> {
    const report = await projectData.applyCastOperations({
      homeDir,
      document: {
        kind: 'castOperations',
        operations: [{
          operation: 'castMember.add',
          castMember: { key: 'sintel', handle: 'sintel', name: 'Sintel', description },
        }],
      },
    });
    return report.generatedIds?.[0]?.id as string;
  }
});
