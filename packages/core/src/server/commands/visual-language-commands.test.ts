import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
} from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import type { ProductionLookbookDocument } from '../visual-language-json/validator.js';

describe('visual language commands', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-visual-language-command-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('creates, lists, renames, reorders, and deletes Inspiration folders', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const ids = createDeterministicIdGenerator();
    const firstReport = await projectData.createInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      name: 'Avatar',
      idGenerator: ids,
    });
    const secondReport = await projectData.createInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      name: 'Avatar',
      idGenerator: ids,
    });
    const first = firstReport.folder;
    const second = secondReport.folder;

    expect(firstReport).toMatchObject({
      valid: true,
      folder: {
        name: 'Avatar',
        projectRelativePath: 'visual-language/inspiration/avatar',
      },
      resourceKeys: expect.arrayContaining([
        'surface:visual-language:inspiration',
        `surface:visual-language:inspiration:${first.id}`,
      ]),
    });
    expect(first).toMatchObject({
      name: 'Avatar',
      projectRelativePath: 'visual-language/inspiration/avatar',
    });
    expect(second.projectRelativePath).toBe('visual-language/inspiration/avatar-2');

    await expect(
      projectData.listInspirationFolders({ projectName: 'constantinople', homeDir })
    ).resolves.toMatchObject({ items: [{ id: first.id }, { id: second.id }] });

    const renameReport = await projectData.renameInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      folderId: second.id,
      name: 'Blade Runner 2049',
    });
    const renamed = renameReport.folder;
    expect(renamed.projectRelativePath).toBe(
      'visual-language/inspiration/blade-runner-2049'
    );

    const savedAgainReport = await projectData.renameInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      folderId: renamed.id,
      name: 'Blade Runner 2049',
    });
    const savedAgain = savedAgainReport.folder;
    expect(savedAgain.projectRelativePath).toBe(renamed.projectRelativePath);

    await expect(
      projectData.reorderInspirationFolders({
        projectName: 'constantinople',
        homeDir,
        folderIds: [renamed.id],
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA246' });

    await projectData.reorderInspirationFolders({
      projectName: 'constantinople',
      homeDir,
      folderIds: [renamed.id, first.id],
    });
    await expect(
      projectData.listInspirationFolders({ projectName: 'constantinople', homeDir })
    ).resolves.toMatchObject({ items: [{ id: renamed.id }, { id: first.id }] });

    const deleted = await projectData.deleteInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      folderId: first.id,
    });
    expect(deleted.recovery?.trashItemIds).toHaveLength(1);
    await expect(
      fs.access(path.join(created.projectPath, first.projectRelativePath))
    ).resolves.toBeUndefined();
    await expect(
      projectData.listInspirationFolders({ projectName: 'constantinople', homeDir })
    ).resolves.toMatchObject({ items: [{ id: renamed.id }] });
  });

  it('reads Inspiration images from the filesystem and validates analysis image references', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const folderReport = await projectData.createInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      name: 'Roger Deakins',
      idGenerator: createDeterministicIdGenerator(),
    });
    const folder = folderReport.folder;
    await projectData.writeInspirationImage({
      projectName: 'constantinople',
      homeDir,
      folderId: folder.id,
      fileName: 'frame-001.png',
      contents: Buffer.from('image bytes'),
    });

    await expect(
      projectData.readInspirationFolder({
        projectName: 'constantinople',
        homeDir,
        folderId: folder.id,
      })
    ).resolves.toMatchObject({
      images: [
        {
          fileName: 'frame-001.png',
          projectRelativePath:
            'visual-language/inspiration/roger-deakins/frame-001.png',
        },
      ],
      analysis: null,
    });

    const validation = await projectData.validateInspirationAnalysis({
      projectName: 'constantinople',
      homeDir,
      folderId: folder.id,
      document: {
        kind: 'inspirationAnalysis',
        analysis: inspirationAnalysisSections('frame-001.png'),
      },
    });
    expect(validation).toMatchObject({
      valid: true,
      folder: { absolutePath: path.join(created.projectPath, folder.projectRelativePath) },
    });

    const report = await projectData.writeInspirationAnalysis({
      projectName: 'constantinople',
      homeDir,
      folderId: folder.id,
      document: {
        kind: 'inspirationAnalysis',
        analysis: inspirationAnalysisSections('frame-001.png'),
      },
    });
    const analysis = report.analysis;
    expect(analysis.thesis.statement).toContain('Reference images');
    expect(report).toMatchObject({
      valid: true,
      changes: [{ type: 'inspirationAnalysis.upserted', folderId: folder.id }],
      resourceKeys: expect.arrayContaining([
        'surface:visual-language:inspiration',
        `surface:visual-language:inspiration:${folder.id}`,
      ]),
    });

    await expect(
      projectData.writeInspirationAnalysis({
        projectName: 'constantinople',
        homeDir,
        folderId: folder.id,
        document: {
          kind: 'inspirationAnalysis',
          analysis: inspirationAnalysisSections('missing.png'),
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA230' });
    await expect(
      projectData.readInspirationAnalysis({
        projectName: 'constantinople',
        homeDir,
        folderId: folder.id,
      })
    ).resolves.toMatchObject({
      valid: true,
      folder: {
        id: folder.id,
        absolutePath: path.join(created.projectPath, folder.projectRelativePath),
      },
      analysis: {
        thesis: {
          statement: expect.stringContaining('Reference images'),
        },
      },
    });

    await expect(
      projectData.validateInspirationAnalysis({
        projectName: 'constantinople',
        homeDir,
        folderId: folder.id,
        document: {
          kind: 'inspirationAnalysis',
          analysis: {
            ...inspirationAnalysisSections('frame-001.png'),
            unknownSection: {},
          },
        } as never,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA230',
      issues: [expect.objectContaining({ code: 'PROJECT_DATA232' })],
    });

    const deleted = await projectData.deleteInspirationImage({
      projectName: 'constantinople',
      homeDir,
      folderId: folder.id,
      fileName: 'frame-001.png',
    });
    expect(deleted.recovery?.trashItemIds).toHaveLength(1);
    await expect(
      fs.access(
        path.join(
          created.projectPath,
          'visual-language/inspiration/roger-deakins/frame-001.png'
        )
      )
    ).resolves.toBeUndefined();
    await expect(
      projectData.readInspirationFolder({
        projectName: 'constantinople',
        homeDir,
        folderId: folder.id,
      })
    ).resolves.toMatchObject({ images: [] });
  });

  it('rejects invalid Lookbook JSON on write and malformed stored JSON on read', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    await expect(
      projectData.writeProductionLookbook({
        projectName: 'constantinople',
        homeDir,
        document: {
          ...lookbookDocument(),
          productionLookbook: {
            ...lookbookSections(),
            name: 'Invalid Lookbook',
            thesis: { statement: 'Missing principles' },
          },
        } as never,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA230' });

    const sourceReport = await projectData.createInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      name: 'The Substance',
    });
    const source = sourceReport.folder;
    await expect(
      projectData.writeProductionLookbook({
        projectName: 'constantinople',
        homeDir,
        document: lookbookDocument([source.id, source.id]),
      })
    ).rejects.toMatchObject({ code: 'CORE_LOOKBOOK_SOURCE_DUPLICATE' });

    await projectData.writeProductionLookbook({
      projectName: 'constantinople',
      homeDir,
      document: lookbookDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });

    const sqlite = new Database(created.databasePath);
    try {
      sqlite.prepare("update lookbook set definition_json = '{ bad json'").run();
    } finally {
      sqlite.close();
    }

    await expect(
      projectData.readProductionLookbook({
        projectName: 'constantinople',
        homeDir,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA230' });
  });

  it('creates and then updates the fixed Production role without changing its id', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const source = await projectData.createInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      name: 'Palette Source',
    });
    const first = await projectData.writeProductionLookbook({
      projectName: 'constantinople',
      homeDir,
      document: lookbookDocument([source.folder.id]),
      idGenerator: createDeterministicIdGenerator(),
    });
    const {
      sourceInspirationFolderIds: _sourceInspirationFolderIds,
      ...documentWithoutSources
    } = lookbookDocument();
    const updated = await projectData.writeProductionLookbook({
      projectName: 'constantinople',
      homeDir,
      document: {
        ...documentWithoutSources,
        productionLookbook: {
          ...lookbookSections(),
          name: 'Revised Production Language',
        },
      },
    });

    expect(first.changes).toEqual([
      { type: 'lookbook.created', lookbookId: first.lookbook.id },
    ]);
    expect(updated).toMatchObject({
      changes: [{ type: 'lookbook.updated', lookbookId: first.lookbook.id }],
      lookbook: {
        id: first.lookbook.id,
        kind: 'production',
        name: 'Revised Production Language',
      },
    });
    await expect(
      projectData.readProjectLookbooks({
        projectName: 'constantinople',
        homeDir,
      })
    ).resolves.toMatchObject({
      production: { lookbook: { id: first.lookbook.id } },
      storyboard: null,
    });
    await expect(
      projectData.listLookbookSourceInspirations({
        projectName: 'constantinople',
        homeDir,
        lookbookId: first.lookbook.id,
      })
    ).resolves.toMatchObject({
      sourceInspirationFolders: [{ id: source.folder.id }],
    });

    await expect(
      projectData.writeProductionLookbook({
        projectName: 'constantinople',
        homeDir,
        document: {
          kind: 'storyboardLookbook',
          storyboardLookbook: {
            name: 'Wrong Role',
            styleBrief: { text: 'Loose graphite.' },
            lineAndFinish: { text: 'Visible construction lines.' },
            valueAndAccent: { text: 'Gray wash.' },
            guardrails: { text: 'Avoid final-film polish.' },
          },
          sourceInspirationFolderIds: [],
        } as never,
      })
    ).rejects.toMatchObject({ code: 'CORE_LOOKBOOK_TARGET_KIND_INVALID' });

    const storyboard = await projectData.writeStoryboardLookbook({
      projectName: 'constantinople',
      homeDir,
      document: {
        kind: 'storyboardLookbook',
        storyboardLookbook: {
          name: 'Graphite Boards',
          styleBrief: { text: 'Loose graphite.' },
          lineAndFinish: { text: 'Visible construction lines.' },
          valueAndAccent: { text: 'Gray wash.' },
          guardrails: { text: 'Avoid final-film polish.' },
        },
        sourceInspirationFolderIds: [],
      },
    });
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'lookbook-sheet.png'), 'sheet');

    await expect(
      projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'lookbook.video-sheet',
        target: { kind: 'lookbook', id: storyboard.lookbook.id },
        sourceProjectRelativePath: 'tmp/lookbook-sheet.png',
      })
    ).rejects.toMatchObject({ code: 'CORE_LOOKBOOK_TARGET_KIND_INVALID' });
    await expect(
      projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'lookbook.storyboard-sheet',
        target: { kind: 'lookbook', id: first.lookbook.id },
        sourceProjectRelativePath: 'tmp/lookbook-sheet.png',
      })
    ).rejects.toMatchObject({ code: 'CORE_LOOKBOOK_TARGET_KIND_INVALID' });
  });
});

function inspirationAnalysisSections(imageFile: string) {
  return {
    thesis: {
      statement: 'Reference images use quiet contrast. The visual logic is restrained and precise.',
      principles: ['Preserve motivated contrast.'],
      imageFiles: [imageFile],
    },
    palette: {
      description: 'Muted colors with disciplined warmth.',
      colors: [{ hex: '#AABBCC', name: 'Cold dawn', meaning: 'Distance and control.' }],
      observations: [{ text: 'Blue-gray dominates.', imageFiles: [imageFile] }],
    },
    toneMood: {
      tone: 'weathered restraint',
      moodTags: ['restrained'],
      description: 'Low saturation and held shadows.',
      imageFiles: [imageFile],
    },
    composition: {
      description: 'Frames use clean planes.',
      patterns: [{ name: 'Held center', description: 'Subjects sit near center.', imageFiles: [imageFile] }],
    },
    lighting: {
      description: 'Practical light leads the scene.',
      patterns: [{ name: 'Window falloff', description: 'Soft windows shape faces.', imageFiles: [imageFile] }],
    },
    texture: {
      description: 'Soft grain and tactile surfaces.',
      observations: [{ text: 'Fine grain supports period texture.', imageFiles: [imageFile] }],
    },
    inspiredBy: {
      description: 'The analysis names affinities rather than confirmed influence.',
      items: [
        {
          category: 'cinematographer' as const,
          name: 'Roger Deakins',
          confidence: 'medium' as const,
          why: 'Restrained contrast and motivated sources.',
          imageFiles: [imageFile],
        },
      ],
    },
  };
}

function lookbookSections() {
  return {
    thesis: {
      statement: 'The movie should feel rigorous and tense. Images favor pressure over spectacle.',
      principles: ['Use negative space as pressure.'],
    },
    palette: {
      description: 'Steel, ash, and controlled ember warmth.',
      colors: [{ hex: '#334455', name: 'Siege steel', meaning: 'Strategic pressure.' }],
      observations: [{ text: 'Warmth appears only near human labor.' }],
    },
    toneMood: {
      tone: 'controlled dread',
      moodTags: ['tense'],
      description: 'Shadows hold detail while highlights stay practical.',
    },
    composition: {
      description: 'Orderly compositions tighten around decisions.',
      patterns: [{ name: 'Map pressure', description: 'Maps and tables compress depth.' }],
    },
    lighting: {
      description: 'Practical pools of warm light cut through cool rooms.',
      patterns: [{ name: 'Lamp islands', description: 'Oil lamps isolate decision makers.' }],
    },
    texture: {
      description: 'Stone, vellum, smoke, and worn metal carry the image texture.',
      observations: [{ text: 'Fine surface texture is visible in midtones.' }],
    },
    camera: {
      description: 'Camera grammar is patient and observant.',
      movement: [{ name: 'Slow push', description: 'Push in only when a decision hardens.' }],
      motion: [{ name: 'Held labor', description: 'Blocking moves with deliberate weight.' }],
      framing: [{ name: 'Measured distance', description: 'Close-ups are rare and earned.' }],
    },
  };
}

function lookbookDocument(
  sourceInspirationFolderIds: string[] = []
): ProductionLookbookDocument {
  return {
    kind: 'productionLookbook' as const,
    productionLookbook: {
      name: 'Siege Steel',
      ...lookbookSections(),
    },
    sourceInspirationFolderIds,
  };
}
