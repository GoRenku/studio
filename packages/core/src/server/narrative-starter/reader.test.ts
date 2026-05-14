import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../index.js';
import { validateNarrativeStarter } from './index.js';
import {
  writeConfig,
  writeNarrativeStarter,
} from '../testing/project-data-fixtures.js';

describe('narrative starter reader', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-narrative-starter-reader-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('collects narrative starter errors and unknown-field warnings together', () => {
    const validation = validateNarrativeStarter({
      kind: 'renku.narrativeStarter',
      version: '0.1.0',
      project: {
        nam: 'constantinople',
        title: 'Preparation of the Siege',
        type: 'standaloneMovie',
        aspectRatio: '16:9',
        logline: 'A documentary about preparation before 1453.',
      },
      languages: [
        { localeTag: 'en-US', isBase: false },
        { localeTag: 'en-US', isBase: false },
      ],
      sequences: [],
    });

    expect(validation.starter).toBeNull();
    expect(validation.result.valid).toBe(false);
    expect(validation.result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'NARRATIVE_STARTER010',
          message: 'project.name is required.',
        }),
        expect.objectContaining({
          code: 'NARRATIVE_STARTER020',
          message: 'Duplicate locale tag: en-US.',
        }),
        expect.objectContaining({
          code: 'NARRATIVE_STARTER021',
        }),
        expect.objectContaining({
          code: 'NARRATIVE_STARTER040',
        }),
      ])
    );
    expect(validation.result.warnings).toEqual([
      expect.objectContaining({
        code: 'NARRATIVE_STARTER012',
        location: expect.objectContaining({ path: ['project', 'nam'] }),
      }),
    ]);
  });

  it('rejects narrative starter Markdown path escapes', async () => {
    const starterPath = await writeNarrativeStarter(homeDir, {
      projectSummaryFile: '../summary.md',
    });

    await expect(
      createProjectDataService().createFromNarrativeStarter({
        starterPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    ).rejects.toMatchObject({
      code: 'NARRATIVE_STARTER999',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'NARRATIVE_STARTER030',
          location: expect.objectContaining({
            path: ['project', 'summaryFile'],
          }),
        }),
      ]),
    });
  });
});
