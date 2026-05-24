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
    const first = await projectData.createInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      name: 'Avatar',
      idGenerator: ids,
    });
    const second = await projectData.createInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      name: 'Avatar',
      idGenerator: ids,
    });

    expect(first).toMatchObject({
      name: 'Avatar',
      projectRelativePath: 'visual-language/inspiration/avatar',
    });
    expect(second.projectRelativePath).toBe('visual-language/inspiration/avatar-2');

    await expect(
      projectData.listInspirationFolders({ projectName: 'constantinople', homeDir })
    ).resolves.toMatchObject({ items: [{ id: first.id }, { id: second.id }] });

    const renamed = await projectData.renameInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      folderId: second.id,
      name: 'Blade Runner 2049',
    });
    expect(renamed.projectRelativePath).toBe(
      'visual-language/inspiration/blade-runner-2049'
    );

    const savedAgain = await projectData.renameInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      folderId: renamed.id,
      name: 'Blade Runner 2049',
    });
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

    await projectData.deleteInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      folderId: first.id,
    });
    await expect(
      fs.access(path.join(created.projectPath, first.projectRelativePath))
    ).rejects.toThrow();
  });

  it('reads Inspiration images from the filesystem and validates analysis image references', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const folder = await projectData.createInspirationFolder({
      projectName: 'constantinople',
      homeDir,
      name: 'Roger Deakins',
      idGenerator: createDeterministicIdGenerator(),
    });
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

    await projectData.deleteInspirationImage({
      projectName: 'constantinople',
      homeDir,
      folderId: folder.id,
      fileName: 'frame-001.png',
    });
    await expect(
      fs.access(
        path.join(
          created.projectPath,
          'visual-language/inspiration/roger-deakins/frame-001.png'
        )
      )
    ).rejects.toThrow();
  });

  it('creates multiple Lookbooks, tracks active state, card images, and deletion', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    const lookbookIds = createDeterministicIdGenerator();
    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Siege Steel',
      sections: lookbookSections(),
      idGenerator: lookbookIds,
    });
    expect(lookbook.id).toBe('lookbook_test0001');
    expect(lookbook.name).toBe('Siege Steel');

    const alternate = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Ivory Fog',
      sections: lookbookSections(),
      idGenerator: lookbookIds,
    });
    expect(alternate.id).toBe('lookbook_test0002');

    await expect(
      projectData.listLookbooks({ projectName: 'constantinople', homeDir })
    ).resolves.toMatchObject({
      activeLookbookId: null,
      lookbooks: [
        { lookbook: { name: 'Siege Steel' }, isActive: false },
        { lookbook: { name: 'Ivory Fog' }, isActive: false },
      ],
    });

    await projectData.setActiveLookbook({
      projectName: 'constantinople',
      homeDir,
      lookbookId: lookbook.id,
    });

    const firstGeneratedPath = 'visual-language/tmp/run-a/generated-look.png';
    const secondGeneratedPath = 'visual-language/tmp/run-b/generated-look.png';
    await fs.mkdir(path.dirname(path.join(created.projectPath, firstGeneratedPath)), {
      recursive: true,
    });
    await fs.mkdir(path.dirname(path.join(created.projectPath, secondGeneratedPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, firstGeneratedPath), 'image bytes');
    await fs.writeFile(path.join(created.projectPath, secondGeneratedPath), 'other image bytes');

    const imageIds = createDeterministicIdGenerator();
    const image = await projectData.importLookbookImage({
      projectName: 'constantinople',
      homeDir,
      lookbookId: lookbook.id,
      projectRelativePath: firstGeneratedPath,
      sections: ['palette', 'lighting'],
      idGenerator: imageIds,
    });
    expect(image.asset.files[0]?.projectRelativePath).toBe(
      'visual-language/lookbook/generated-look.png'
    );
    const secondImage = await projectData.importLookbookImage({
      projectName: 'constantinople',
      homeDir,
      lookbookId: lookbook.id,
      projectRelativePath: secondGeneratedPath,
      sections: ['palette'],
      idGenerator: imageIds,
    });
    expect(secondImage.asset.files[0]?.projectRelativePath).toBe(
      'visual-language/lookbook/generated-look-2.png'
    );

    await projectData.setLookbookCardImage({
      projectName: 'constantinople',
      homeDir,
      lookbookId: lookbook.id,
      imageId: image.id,
    });

    const resource = await projectData.readLookbook({
      projectName: 'constantinople',
      homeDir,
      lookbookId: lookbook.id,
    });
    expect(resource.lookbook.name).toBe('Siege Steel');
    expect(resource.isActive).toBe(true);
    expect(resource.cardImage?.id).toBe(image.id);
    expect(resource.imagesBySection.palette).toHaveLength(2);
    expect(resource.imagesBySection.lighting).toHaveLength(1);

    const updated = await projectData.setLookbookImageSections({
      projectName: 'constantinople',
      homeDir,
      imageId: image.id,
      sections: ['camera', 'texture'],
      idGenerator: createDeterministicIdGenerator(),
    });
    expect(updated.sections).toEqual(['camera', 'texture']);

    await projectData.deleteLookbookImage({
      projectName: 'constantinople',
      homeDir,
      imageId: image.id,
    });
    await expect(
      fs.access(path.join(created.projectPath, 'visual-language/lookbook/generated-look.png'))
    ).rejects.toThrow();
    await expect(
      fs.access(path.join(created.projectPath, 'visual-language/lookbook/generated-look-2.png'))
    ).resolves.toBeUndefined();

    await projectData.deleteLookbook({
      projectName: 'constantinople',
      homeDir,
      lookbookId: lookbook.id,
    });
    await expect(
      projectData.listLookbooks({ projectName: 'constantinople', homeDir })
    ).resolves.toMatchObject({
      activeLookbookId: null,
      lookbooks: [{ lookbook: { name: 'Ivory Fog' }, isActive: false }],
    });
    await expect(
      fs.access(path.join(created.projectPath, 'visual-language/lookbook/generated-look-2.png'))
    ).rejects.toThrow();
  });

  it('rejects invalid Lookbook JSON on write and malformed stored JSON on read', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }

    await expect(
      projectData.createLookbook({
        projectName: 'constantinople',
        homeDir,
        name: 'Invalid Lookbook',
        sections: {
          ...lookbookSections(),
          thesis: { statement: 'Missing principles' },
        } as never,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA230' });

    const lookbook = await projectData.createLookbook({
      projectName: 'constantinople',
      homeDir,
      name: 'Corruptible Lookbook',
      sections: lookbookSections(),
      idGenerator: createDeterministicIdGenerator(),
    });

    const sqlite = new Database(created.databasePath);
    try {
      sqlite.prepare("update lookbook set thesis = '{ bad json'").run();
    } finally {
      sqlite.close();
    }

    await expect(
      projectData.readLookbook({
        projectName: 'constantinople',
        homeDir,
        lookbookId: lookbook.id,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA230' });
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
