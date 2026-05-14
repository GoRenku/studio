import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../index.js';
import {
  runCreateOrSkip,
  writeConfig,
  writeNarrativeStarter,
} from '../testing/project-data-fixtures.js';

describe('create project from narrative starter', () => {
  let homeDir: string;
  let storageRoot: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-create-project-from-narrative-starter-test-'));
    storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('creates a project from narrative starter YAML with Markdown references', async () => {
    const starterPath = await writeNarrativeStarter(homeDir);
    const projectData = createProjectDataService();

    const result = await runCreateOrSkip(
      projectData.createFromNarrativeStarter({
        starterPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!result) {
      return;
    }

    expect(result).toMatchObject({
      projectName: 'constantinople',
      projectPath: path.join(storageRoot, 'constantinople'),
      coverPath: path.join(storageRoot, 'constantinople', 'cover.png'),
      created: {
        languages: 1,
        castMembers: 2,
        visualLanguageCategories: 2,
        visualLanguage: 1,
        continuityReferences: 1,
        episodes: 0,
        sequences: 1,
        scenes: 1,
        clips: 1,
      },
      warnings: [],
    });
    await expect(fs.readFile(result.coverPath!, 'utf8')).resolves.toBe(
      'narrative cover'
    );

    const project = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    expect(project.identity).toMatchObject({
      name: 'constantinople',
      title: 'Preparation of the Siege',
      type: 'standaloneMovie',
      aspectRatio: '16:9',
      logline: 'A documentary about preparation before 1453.',
      summary: 'Project summary from Markdown.',
    });
    expect(project.cast).toEqual([
      expect.objectContaining({
        name: 'Narrator',
        kind: 'narrator',
        role: 'Voiceover',
      }),
      expect.objectContaining({
        name: 'Mehmed II',
        kind: 'historical_figure',
        role: 'Protagonist',
        shortDescription: 'Young Ottoman sultan.',
      }),
    ]);
    expect(project.visualLanguageCategories).toEqual([
      expect.objectContaining({
        name: 'Lighting',
        description: 'Light behavior and source logic.',
      }),
      expect.objectContaining({
        name: 'Camera',
        description: 'Camera placement and motion.',
      }),
    ]);
    expect(project.visualLanguage[0]).toMatchObject({
      name: 'Practical-source low-key interiors',
      summary: 'Warm practical interiors.',
      priority: 'default',
      guidance: 'Lighting guidance from Markdown.',
      prompt: 'Lighting prompt from Markdown.',
      guidanceAsset: expect.objectContaining({ role: 'guidance' }),
      promptAsset: expect.objectContaining({ role: 'prompt' }),
    });
    expect(project.continuityReferences[0]).toMatchObject({
      kind: 'location',
      name: "Mehmed's council chamber",
      summary: 'Formal Ottoman planning room.',
      description: 'Continuity description from Markdown.',
      descriptionAsset: expect.objectContaining({ role: 'description' }),
    });
    const mehmed = project.cast.find((castMember) => castMember.name === 'Mehmed II');
    expect(mehmed).toBeDefined();
    const castDesign = await projectData.readCastDesignResource({
      projectName: 'constantinople',
      homeDir,
      castMemberId: mehmed?.id ?? '',
    });
    expect(castDesign.descriptionAsset).toMatchObject({
      role: 'description',
      projectRelativePath: 'working-assets/base/cast/02-mehmed-ii/description.md',
    });
    await expect(
      projectData.readMarkdownAssetContent({
        projectName: 'constantinople',
        homeDir,
        assetId: castDesign.descriptionAsset?.assetId ?? '',
        assetFileId: castDesign.descriptionAsset?.assetFileId ?? '',
      })
    ).resolves.toMatchObject({
      content: 'Cast description from Markdown.\n',
    });
    expect(project.identity.summaryAsset).toMatchObject({
      role: 'summary',
      projectRelativePath: 'working-assets/base/narrative/project-summary.md',
    });
    expect(project.sequences[0]).toMatchObject({
      title: "The Young Sultan's Obsession",
      shortTitle: 'Ambition',
      summary: 'Mehmed turns conquest into policy.',
    });
    expect(project.sequences[0]?.scenes[0]?.clips[0]).toMatchObject({
      title: 'The New Sultan',
      summary: 'Clip summary from Markdown.',
      visualIntent: 'Quiet court staging from Markdown.',
    });

    await expect(
      fs.readFile(
        path.join(
          result.projectPath,
          'working-assets',
          'base',
          'sequences',
          '01-the-young-sultan-s-obsession',
          'scenes',
          '01-a-throne-facing-an-ancient-city',
          'clips',
          '01-the-new-sultan',
          'visual-intent.md'
        ),
        'utf8'
      )
    ).resolves.toBe('Quiet court staging from Markdown.\n');
  });

  it('requires narrative starter project name in YAML', async () => {
    const starterPath = await writeNarrativeStarter(homeDir, {
      projectNameLine: '',
    });
    const projectData = createProjectDataService();

    await expect(
      projectData.createFromNarrativeStarter({
        starterPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    ).rejects.toMatchObject({
      code: 'NARRATIVE_STARTER999',
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'NARRATIVE_STARTER010',
          message: 'project.name is required.',
        }),
      ]),
    });
    await expect(
      fs.stat(path.join(storageRoot, 'constantinople', '.renku', 'project.sqlite'))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('fails before creating a project folder when narrative starter validation has errors', async () => {
    const starterPath = await writeInvalidNarrativeStarter(homeDir);

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
          code: 'NARRATIVE_STARTER010',
          message: 'project.title is required.',
        }),
      ]),
    });
    await expect(
      fs.stat(path.join(storageRoot, 'constantinople'))
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

async function writeInvalidNarrativeStarter(homeDir: string): Promise<string> {
  const starterPath = path.join(homeDir, 'invalid-narrative.yaml');
  await fs.writeFile(
    starterPath,
    `kind: renku.narrativeStarter
version: 0.1.0

project:
  name: constantinople
  type: standaloneMovie
  aspectRatio: "16:9"
  logline: A documentary about preparation before 1453.

languages:
  - localeTag: en-US
    isBase: true

sequences:
  - title: Ambition
`,
    'utf8'
  );
  return starterPath;
}
