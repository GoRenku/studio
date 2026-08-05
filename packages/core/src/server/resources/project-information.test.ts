import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectInformationPatch } from '../../client/index.js';
import { createProjectDataService, type ProjectRelativePath } from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';

describe('project information resource', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-project-information-resource-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('updates project information without changing the immutable project name', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const resource = await projectData.patchProjectInformation({
      projectName: 'constantinople',
      homeDir,
      patch: {
        title: 'The Siege Machine',
        aspectRatio: '21:9',
        logline: 'A sharper premise.',
        synopsis: 'A revised project synopsis.',
        languages: [
          {
            operation: 'update',
            localeTag: 'tr-TR',
            isBase: true,
            supportsAudio: false,
          },
        ],
      },
    });

    expect(resource).toMatchObject({
      title: 'The Siege Machine',
      aspectRatio: '21:9',
      logline: 'A sharper premise.',
      synopsis: 'A revised project synopsis.',
    });
    expect(resource.languages).toEqual([
      expect.objectContaining({
        localeTag: 'en-US',
        isBase: false,
        supportsAudio: true,
        supportsSubtitles: true,
      }),
      expect.objectContaining({
        localeTag: 'tr-TR',
        isBase: true,
        supportsAudio: false,
        supportsSubtitles: true,
      }),
    ]);
  });

  it('changes each supported scalar independently and preserves every omitted field', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const seeded = await projectData.patchProjectInformation({
      projectName: 'constantinople',
      homeDir,
      patch: {
        intendedAudience: 'Festival audiences',
        format: 'Short film',
        targetRuntimeMinutes: 12,
        primaryGenre: 'Historical drama',
        secondaryGenres: ['War'],
        tones: ['Tense'],
        contentRatingIntent: 'PG-13',
        creativeBoundaries: ['No graphic violence'],
        centralConflict: 'The city prepares for siege.\n',
        dramaticQuestion: 'Can preparation change history?',
        themes: ['Legacy'],
        historicalBasis: ['The 1453 siege'],
        dramatizedElements: ['Composite engineers'],
        screenplayDraftStatus: 'first-draft',
        researchSources: ['Primary chronicle'],
        assumptions: ['A spring timeline'],
        openQuestions: ['Who funds the defense?'],
        nextSteps: ['Verify the siege chronology'],
      },
    });

    let current = seeded;
    for (const scalarCase of PROJECT_INFORMATION_SCALAR_PATCH_CASES) {
      const resource = await projectData.patchProjectInformation({
        projectName: 'constantinople',
        homeDir,
        patch: scalarPatch(scalarCase.field, scalarCase.value),
      });

      expect(resource).toEqual({
        ...current,
        [scalarCase.field]: scalarCase.value,
      });
      current = resource;
    }
  });

  it('persists explicit clears for every clearable scalar field', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    let current = await projectData.patchProjectInformation({
      projectName: 'constantinople',
      homeDir,
      patch: {
        aspectRatio: '21:9',
        logline: 'Seed logline',
        synopsis: 'Seed synopsis',
        premise: 'Seed premise',
        intendedAudience: 'Seed audience',
        format: 'Seed format',
        targetRuntimeMinutes: 12,
        primaryGenre: 'Seed genre',
        secondaryGenres: ['Seed secondary genre'],
        tones: ['Seed tone'],
        contentRatingIntent: 'Seed rating',
        creativeBoundaries: ['Seed boundary'],
        centralConflict: 'Seed conflict',
        dramaticQuestion: 'Seed question',
        themes: ['Seed theme'],
        historicalBasis: ['Seed history'],
        dramatizedElements: ['Seed dramatization'],
        screenplayDraftStatus: 'Seed draft status',
        researchSources: ['Seed source'],
        assumptions: ['Seed assumption'],
        openQuestions: ['Seed open question'],
        nextSteps: ['Seed next step'],
      },
    });

    for (const field of PROJECT_INFORMATION_CLEARABLE_FIELDS) {
      const resource = await projectData.patchProjectInformation({
        projectName: 'constantinople',
        homeDir,
        patch: scalarPatch(field, null),
      });
      const expected: Record<string, unknown> = { ...current };
      if (field === 'aspectRatio') {
        expected.aspectRatio = '16:9';
      } else {
        delete expected[field];
      }
      expect(resource).toEqual(expected);
      current = resource;
    }
  });

  it('resets the project aspect ratio to the effective default through a patch', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    await projectData.patchProjectInformation({
      projectName: 'constantinople',
      homeDir,
      patch: { aspectRatio: '21:9' },
    });
    const resource = await projectData.patchProjectInformation({
      projectName: 'constantinople',
      homeDir,
      patch: { aspectRatio: null },
    });

    expect(resource.aspectRatio).toBe('16:9');
  });

  it('replaces and clears only the named string-array field', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    await projectData.patchProjectInformation({
      projectName: 'constantinople',
      homeDir,
      patch: { themes: ['Legacy'], tones: ['Tense'] },
    });
    const replaced = await projectData.patchProjectInformation({
      projectName: 'constantinople',
      homeDir,
      patch: { themes: ['Ambition'] },
    });
    expect(replaced.themes).toEqual(['Ambition']);
    expect(replaced.tones).toEqual(['Tense']);

    const cleared = await projectData.patchProjectInformation({
      projectName: 'constantinople',
      homeDir,
      patch: { themes: null },
    });
    expect(cleared.themes).toBeUndefined();
    expect(cleared.tones).toEqual(['Tense']);
  });

  it('clears the SQLite-backed project synopsis through a patch', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    await projectData.patchProjectInformation({
      projectName: 'constantinople',
      homeDir,
      patch: { synopsis: null },
    });

    await expect(
      projectData.readProject({ projectName: 'constantinople', homeDir })
    ).resolves.toMatchObject({
      synopsis: undefined,
    });
  });

  it('rejects removing a locale that still has asset relationships', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const assetPath = 'screenplay/project-reference.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, assetPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, assetPath), 'image bytes');
    await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'project' },
      locale: { localeId: 'locale_test0001' },
      type: 'reference',
      mediaKind: 'image',
      title: 'Project reference',
      projectRelativePath: assetPath as ProjectRelativePath,
      fileRole: 'primary',
    });

    const before = await projectData.readProjectInformationResource({
      projectName: 'constantinople',
      homeDir,
    });
    await expect(
      projectData.patchProjectInformation({
        projectName: 'constantinople',
        homeDir,
        patch: {
          title: 'This scalar write must roll back',
          languages: [
            {
              operation: 'setBase',
              localeTag: 'tr-TR',
            },
            { operation: 'remove', localeTag: 'en-US' },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA058',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'PROJECT_DATA057',
          message: expect.stringContaining('Asset'),
        }),
      ]),
    });
    await expect(
      projectData.readProjectInformationResource({
        projectName: 'constantinople',
        homeDir,
      })
    ).resolves.toEqual(before);
  });

  it('collects project information validation errors', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const before = await projectData.readProjectInformationResource({
      projectName: 'constantinople',
      homeDir,
    });
    await expect(
      projectData.patchProjectInformation({
        projectName: 'constantinople',
        homeDir,
        patch: {
          title: '',
          aspectRatio: '2:1',
          languages: [
            {
              operation: 'update',
              localeTag: 'en-US',
              isBase: false,
            },
            {
              operation: 'add',
              localeTag: 'en-US',
              displayName: 'English',
              isBase: false,
              supportsAudio: true,
              supportsSubtitles: true,
            },
            {
              operation: 'add',
              localeTag: 'xx-XX',
              displayName: 'Unsupported',
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA056',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'PROJECT_DATA050' }),
        expect.objectContaining({ code: 'PROJECT_DATA051' }),
        expect.objectContaining({ code: 'PROJECT_DATA053' }),
        expect.objectContaining({ code: 'PROJECT_DATA054' }),
        expect.objectContaining({ code: 'PROJECT_DATA055' }),
      ]),
    });
    await expect(
      projectData.readProjectInformationResource({
        projectName: 'constantinople',
        homeDir,
      })
    ).resolves.toEqual(before);
  });

  it('rejects zero locales and multiple base locales without changing persisted state', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const before = await projectData.readProjectInformationResource({
      projectName: 'constantinople',
      homeDir,
    });

    await expect(
      projectData.patchProjectInformation({
        projectName: 'constantinople',
        homeDir,
        patch: {
          languages: [
            { operation: 'remove', localeTag: 'en-US' },
            { operation: 'remove', localeTag: 'tr-TR' },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA056',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'PROJECT_DATA052' }),
        expect.objectContaining({ code: 'PROJECT_DATA055' }),
      ]),
    });

    await expect(
      projectData.patchProjectInformation({
        projectName: 'constantinople',
        homeDir,
        patch: {
          languages: [
            {
              operation: 'add',
              localeTag: 'en-US',
              displayName: 'English duplicate',
              isBase: true,
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA056',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'PROJECT_DATA054' }),
        expect.objectContaining({ code: 'PROJECT_DATA055' }),
      ]),
    });

    await expect(
      projectData.readProjectInformationResource({
        projectName: 'constantinople',
        homeDir,
      })
    ).resolves.toEqual(before);
  });
});

type ProjectInformationScalarField = Exclude<
  keyof ProjectInformationPatch,
  'languages'
>;

const PROJECT_INFORMATION_SCALAR_PATCH_CASES: Array<{
  field: ProjectInformationScalarField;
  value: string | number | string[];
}> = [
  { field: 'title', value: 'Updated title' },
  { field: 'aspectRatio', value: '21:9' },
  { field: 'logline', value: 'Updated logline' },
  { field: 'synopsis', value: 'Updated synopsis' },
  { field: 'premise', value: 'Updated premise' },
  { field: 'intendedAudience', value: 'Updated audience' },
  { field: 'format', value: 'Updated format' },
  { field: 'targetRuntimeMinutes', value: 42 },
  { field: 'primaryGenre', value: 'Updated genre' },
  { field: 'secondaryGenres', value: ['Updated secondary genre'] },
  { field: 'tones', value: ['Updated tone'] },
  { field: 'contentRatingIntent', value: 'Updated rating' },
  { field: 'creativeBoundaries', value: ['Updated boundary'] },
  { field: 'centralConflict', value: 'Updated conflict' },
  { field: 'dramaticQuestion', value: 'Updated dramatic question' },
  { field: 'themes', value: ['Updated theme'] },
  { field: 'historicalBasis', value: ['Updated historical basis'] },
  { field: 'dramatizedElements', value: ['Updated dramatized element'] },
  { field: 'screenplayDraftStatus', value: 'Updated draft status' },
  { field: 'researchSources', value: ['Updated research source'] },
  { field: 'assumptions', value: ['Updated assumption'] },
  { field: 'openQuestions', value: ['Updated open question'] },
  { field: 'nextSteps', value: ['Updated next step'] },
];

const PROJECT_INFORMATION_CLEARABLE_FIELDS = PROJECT_INFORMATION_SCALAR_PATCH_CASES
  .map(({ field }) => field)
  .filter((field) => field !== 'title');

function scalarPatch(
  field: ProjectInformationScalarField,
  value: string | number | string[] | null
): ProjectInformationPatch {
  return { [field]: value } as ProjectInformationPatch;
}
