import Database from 'better-sqlite3';
import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../../../testing/shot-video-take-fixtures.js';
import { createTestAssetFixture } from '../../../../testing/asset-fixture-helpers.js';
import {
  createDeterministicIdGenerator,
  type ProjectRelativePath,
} from '../../../../index.js';

describe('scene shot video takes', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  function assetFileHash(assetFileId: string): string | null {
    const db = openCurrentProjectDatabase();
    try {
      const row = db
        .prepare('select content_hash from asset_file where id = ?')
        .get(assetFileId) as { content_hash: string | null } | undefined;
      return row?.content_hash ?? null;
    } finally {
      db.close();
    }
  }

  function corruptInputAssetFile(input: {
    inputId: string;
    assetId: string;
    assetFileId: string;
    createdAt?: string;
  }): void {
    const db = openCurrentProjectDatabase();
    try {
      if (input.createdAt) {
        db.prepare(
          'update scene_shot_video_take_media_input set asset_id = ?, asset_file_id = ?, created_at = ? where id = ?'
        ).run(input.assetId, input.assetFileId, input.createdAt, input.inputId);
      } else {
        db.prepare(
          'update scene_shot_video_take_media_input set asset_id = ?, asset_file_id = ? where id = ?'
        ).run(input.assetId, input.assetFileId, input.inputId);
      }
    } finally {
      db.close();
    }
  }

  function openCurrentProjectDatabase() {
    return new Database(
      path.join(
        homeDir,
        'projects',
        'constantinople',
        '.renku',
        'project.sqlite'
      )
    );
  }

  async function currentProjectFolder(): Promise<string> {
    const project = await projectData.readCurrentProject({ homeDir });
    if (!project) {
      throw new Error('Expected current project to exist.');
    }
    return project.projectFolder;
  }

  async function removeProjectFile(projectRelativePath: string): Promise<void> {
    await fs.unlink(path.join(await currentProjectFolder(), projectRelativePath));
  }

  async function projectFilesUnder(projectRelativePath: string): Promise<string[]> {
    const files: string[] = [];
    const root = path.join(await currentProjectFolder(), projectRelativePath);

    async function visit(folderPath: string, relativeFolder: string): Promise<void> {
      let entries: import('node:fs').Dirent[];
      try {
        entries = await fs.readdir(folderPath, { withFileTypes: true });
      } catch (error) {
        if (isNodeError(error) && error.code === 'ENOENT') {
          return;
        }
        throw error;
      }
      for (const entry of entries) {
        const entryPath = path.join(folderPath, entry.name);
        const relativePath = path.join(relativeFolder, entry.name);
        if (entry.isDirectory()) {
          await visit(entryPath, relativePath);
        } else if (entry.isFile()) {
          files.push(relativePath);
        }
      }
    }

    await visit(root, projectRelativePath);
    return files.sort();
  }

  function isNodeError(error: unknown): error is Error & { code: string } {
    return (
      error instanceof Error &&
      typeof (error as { code?: unknown }).code === 'string'
    );
  }

  it('creates takes as unpicked by default and toggles take picks', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    expect(written.take.picked).toBe(false);

    const picked = await projectData.updateSceneShotVideoTakePick({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      picked: true,
    });
    expect(picked.take.picked).toBe(true);

    const cleared = await projectData.updateSceneShotVideoTakePick({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      picked: false,
    });
    expect(cleared.take.picked).toBe(false);
  });

  it('lists picked takes before unpicked takes', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const pickedTakeReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
      title: 'Picked take',
    });
    const pickedTake = pickedTakeReport.overview.take;
    expect(pickedTakeReport.resourceKeys).toEqual(
      expect.arrayContaining([
        `surface:scene:${ids.sceneId}:takes`,
        `scene-shot-video-take:${pickedTake.takeId}`,
      ])
    );

    await projectData.updateSceneShotVideoTakePick({
      homeDir,
      sceneId: ids.sceneId,
      takeId: pickedTake.takeId,
      picked: true,
    });

    const report = await projectData.listSceneShotVideoTakes({
      homeDir,
      sceneId: ids.sceneId,
    });
    expect(report.takes[0]?.take).toMatchObject({
      takeId: pickedTake.takeId,
      picked: true,
    });
    expect(
      report.takes.find(
        (overview) => overview.take.takeId === written.take.takeId
      )?.take
    ).toMatchObject({ picked: false });
  });

  it('returns source shot list storyboard images when creating a take', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/shot-001-storyboard.png',
      'shot one storyboard'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/shot-002-storyboard.png',
      'shot two storyboard'
    );
    await projectData.importSceneStoryboardImagesMedia({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      document: {
        kind: 'sceneStoryboardImagesImport',
        shotListId: written.shotList.id,
        shots: [
          {
            shotId: 'shot_001',
            source: 'generated/media/shot-001-storyboard.png',
          },
          {
            shotId: 'shot_002',
            source: 'generated/media/shot-002-storyboard.png',
          },
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });

    const report = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      title: 'Storyboard-backed take',
    });

    expect(report.overview.take).toMatchObject({
      title: 'Storyboard-backed take',
      sourceShotListId: written.shotList.id,
      shotIds: ['shot_001'],
    });
    expect(report.overview.sourceShotList.id).toBe(written.shotList.id);
    expect(report.overview.displayShots.map((shot) => shot.shotId)).toEqual([
      'shot_001',
      'shot_002',
    ]);
    expect(report.overview.storyboardImages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          shotId: 'shot_001',
          mediaKind: 'image',
        }),
      ])
    );
  });

  it('lists takes with broken shot membership as read-only instead of failing the scene list', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const takeId = written.take.takeId;

    await projectData.updateSceneShotVideoTakeStructureMode({
      homeDir,
      sceneId: ids.sceneId,
      takeId,
      mode: 'multi-cut',
    });

    const project = await projectData.readCurrentProject({ homeDir });
    if (!project) {
      throw new Error('Expected current project to exist.');
    }
    const db = new Database(
      path.join(project.projectFolder, '.renku', 'project.sqlite')
    );
    try {
      db.prepare(
        'delete from scene_shot_video_take_shot where take_id = ?'
      ).run(takeId);
    } finally {
      db.close();
    }

    const report = await projectData.listSceneShotVideoTakes({
      homeDir,
      sceneId: ids.sceneId,
    });
    const listedTake = report.takes.find(
      (overview) => overview.take.takeId === takeId
    )?.take;

    expect(listedTake).toMatchObject({
      takeId,
      shotIds: [],
      status: {
        editability: {
          state: 'read-only',
          diagnostics: [
            expect.objectContaining({
              code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SHOT_MEMBERSHIP',
            }),
          ],
        },
        runnability: {
          state: 'blocked',
        },
      },
    });
    await expect(
      projectData.updateSceneShotVideoTakePick({
        homeDir,
        sceneId: ids.sceneId,
        takeId,
        picked: true,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA420',
      issues: [
        expect.objectContaining({
          code: 'CORE_SHOT_VIDEO_TAKE_STRUCTURE_MISSING_SHOT_MEMBERSHIP',
        }),
      ],
    });
  });

  it('rejects wrong-scene take pick updates before changing the take', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await expect(
      projectData.updateSceneShotVideoTakePick({
        homeDir,
        sceneId: 'scene_wrong',
        takeId: written.take.takeId,
        picked: true,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA423' });

    await expect(
      projectData.readSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
      })
    ).resolves.toMatchObject({ picked: false });
  });

  it('continues editing on a new take when production settings change after finalization', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceTakeId = written.take.takeId;
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/first-production-prompt-sheet.png',
      'first production prompt sheet'
    );
    await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/first-production-prompt-sheet.png',
      title: 'First production prompt sheet',
    });
    const sourceTakeWithPromptSheet = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
    });

    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      production: {
        ...sourceTakeWithPromptSheet.state.production,
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        requestedInputs: [
          {
            kind: 'video-prompt-sheet',
            subjectKind: 'take',
            subjectId: sourceTakeId,
          },
        ],
        customPromptNote: 'First finished-video settings.',
      },
    });
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/first-production-take.mp4',
      'first production video'
    );
    await projectData.importShotVideoTake({
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/first-production-take.mp4',
      title: 'First production take',
    });

    const continued = await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      production: {
        ...sourceTakeWithPromptSheet.state.production,
        inputModeId: 'text-only',
        modelChoice: 'fal-ai/bytedance/seedance-2.0',
        requestedInputs: [
          {
            kind: 'video-prompt-sheet',
            subjectKind: 'take',
            subjectId: sourceTakeId,
          },
        ],
        customPromptNote: 'Tighter second-attempt settings.',
      },
    });

    expect(continued.take.takeId).not.toBe(sourceTakeId);
    expect(continued.take.regeneratedFromTakeId).toBe(sourceTakeId);
    expect(continued.take.video).toBeNull();
    expect(continued.take.state.production.customPromptNote).toBe(
      'Tighter second-attempt settings.'
    );
    expect(continued.take.state.production.requestedInputs).toEqual([
      expect.objectContaining({
        kind: 'video-prompt-sheet',
        subjectKind: 'take',
        subjectId: continued.take.takeId,
      }),
    ]);
    expect(continued.take.state.production.preparedInputs).toEqual([
      expect.objectContaining({
        kind: 'video-prompt-sheet',
        subjectKind: 'take',
        subjectId: continued.take.takeId,
      }),
    ]);
    expect(continued.resourceKeys).toEqual(
      expect.arrayContaining([
        `scene-shot-video-take:${sourceTakeId}`,
        `scene-shot-video-take:${continued.take.takeId}`,
        `scene-shot-video-take-video:${sourceTakeId}`,
        `surface:scene:${ids.sceneId}:takes`,
      ])
    );

    const sourceTake = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
    });
    expect(sourceTake.video?.projectRelativePath).toMatch(
      /^shots\/.+\/take-for-shot-001-01\/video\.mp4$/
    );
    expect(sourceTake.state.production.customPromptNote).toBe(
      'First finished-video settings.'
    );
    expect(sourceTake.state.production.requestedInputs).toEqual([
      expect.objectContaining({
        subjectKind: 'take',
        subjectId: sourceTakeId,
      }),
    ]);
    expect(sourceTake.state.production.preparedInputs).toEqual([
      expect.objectContaining({
        subjectKind: 'take',
        subjectId: sourceTakeId,
      }),
    ]);
  });

  it('deep-copies selected take-owned prompt sheets when continuing a finalized take', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceTakeId = written.take.takeId;
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/deep-copy-prompt-sheet.png',
      'prompt sheet bytes'
    );
    await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/deep-copy-prompt-sheet.png',
      title: 'Deep copy prompt sheet',
    });
    const sourceTakeWithPromptSheet = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
    });
    const sourceInputBefore = (
      await projectData.listShotVideoTakeInputs({
        homeDir,
        takeId: sourceTakeId,
      })
    ).inputs.find((input) => input.kind === 'video-prompt-sheet');
    if (!sourceInputBefore) {
      throw new Error('Expected source Video Prompt Sheet input.');
    }
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/deep-copy-final.mp4',
      'final video bytes'
    );
    await projectData.importShotVideoTake({
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/deep-copy-final.mp4',
      title: 'Deep copy final',
    });

    const continued = await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      production: {
        ...sourceTakeWithPromptSheet.state.production,
        requestedInputs: [
          {
            kind: 'video-prompt-sheet',
            subjectKind: 'take',
            subjectId: sourceTakeId,
          },
        ],
        customPromptNote: 'Continue with copied prompt sheet.',
      },
    });
    const copiedInput = continued.mediaInputs.find(
      (input) => input.kind === 'video-prompt-sheet'
    );
    if (!copiedInput) {
      throw new Error('Expected copied Video Prompt Sheet input.');
    }

    expect(copiedInput.assetId).not.toBe(sourceInputBefore.assetId);
    expect(copiedInput.assetFileId).not.toBe(sourceInputBefore.assetFileId);
    expect(copiedInput.projectRelativePath).not.toBe(
      sourceInputBefore.projectRelativePath
    );
    expect(copiedInput.projectRelativePath).toMatch(
      /^shots\/.+\/take-for-shot-001-iteration-02\/video-prompt-sheet\.png$/
    );
    await expect(
      shotVideoTakeProject.projectFileExists(copiedInput.projectRelativePath)
    ).resolves.toBe(true);
    expect(assetFileHash(copiedInput.assetFileId)).toBe(
      assetFileHash(sourceInputBefore.assetFileId)
    );
    expect(continued.take.state.production.preparedInputs).toEqual([
      expect.objectContaining({
        kind: 'video-prompt-sheet',
        assetId: copiedInput.assetId,
        assetFileId: copiedInput.assetFileId,
        subjectKind: 'take',
        subjectId: continued.take.takeId,
      }),
    ]);

    await projectData.deleteSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: continued.take.takeId,
    });
    await expect(
      projectData.listShotVideoTakeInputs({
        homeDir,
        takeId: sourceTakeId,
      })
    ).resolves.toMatchObject({
      inputs: [
        expect.objectContaining({
          inputId: sourceInputBefore.inputId,
          assetId: sourceInputBefore.assetId,
          selected: true,
        }),
      ],
    });
  });

  it('deep-copies prepared take-owned inputs even when the source input is unselected', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceTakeId = written.take.takeId;
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/prepared-only-first-frame.png',
      'prepared-only first frame bytes'
    );
    const firstFrame = await projectData.importShotInputMedia({
      inputKind: 'first-frame',
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/prepared-only-first-frame.png',
      title: 'Prepared-only first frame',
      selection: 'take',
    });
    expect(firstFrame.mediaInput.selected).toBe(false);
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/prepared-only-final.mp4',
      'prepared-only final video bytes'
    );
    await projectData.importShotVideoTake({
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/prepared-only-final.mp4',
      title: 'Prepared-only final',
    });

    const continued = await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      production: {
        requestedInputs: [
          {
            kind: 'first-frame',
            subjectKind: 'shot',
            subjectId: 'shot_001',
          },
        ],
        preparedInputs: [
          {
            kind: 'first-frame',
            assetId: firstFrame.mediaInput.assetId,
            assetFileId: firstFrame.mediaInput.assetFileId,
            subjectKind: 'shot',
            subjectId: 'shot_001',
          },
        ],
        customPromptNote: 'Continue with prepared-only first frame.',
      },
    });
    const copiedInput = continued.mediaInputs.find(
      (input) =>
        input.kind === 'first-frame' &&
        input.assetId !== firstFrame.mediaInput.assetId
    );
    if (!copiedInput) {
      throw new Error('Expected copied prepared-only First Frame input.');
    }

    expect(copiedInput.selected).toBe(false);
    expect(copiedInput.assetFileId).not.toBe(firstFrame.mediaInput.assetFileId);
    expect(copiedInput.projectRelativePath).toMatch(
      /^shots\/.+\/take-for-shot-001-iteration-02\/first-frame\.png$/
    );
    expect(continued.take.state.production.preparedInputs).toEqual([
      expect.objectContaining({
        kind: 'first-frame',
        assetId: copiedInput.assetId,
        assetFileId: copiedInput.assetFileId,
        subjectKind: 'shot',
        subjectId: 'shot_001',
      }),
    ]);

    await projectData.deleteSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
    });
    await expect(
      shotVideoTakeProject.projectFileExists(copiedInput.projectRelativePath)
    ).resolves.toBe(true);
  });

  it('rolls back the iteration and copied files when take-owned media copy fails', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceTakeId = written.take.takeId;
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/rollback-prompt-sheet.png',
      'rollback prompt sheet bytes'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/rollback-first-frame.png',
      'rollback first frame bytes'
    );
    const promptSheet = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/rollback-prompt-sheet.png',
      title: 'Rollback prompt sheet',
    });
    const firstFrame = await projectData.importShotInputMedia({
      inputKind: 'first-frame',
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/rollback-first-frame.png',
      title: 'Rollback first frame',
    });
    corruptInputAssetFile({
      inputId: promptSheet.mediaInput.inputId,
      assetId: promptSheet.mediaInput.assetId,
      assetFileId: promptSheet.mediaInput.assetFileId,
      createdAt: '2000-01-01T00:00:00.000Z',
    });
    corruptInputAssetFile({
      inputId: firstFrame.mediaInput.inputId,
      assetId: firstFrame.mediaInput.assetId,
      assetFileId: firstFrame.mediaInput.assetFileId,
      createdAt: '9999-12-31T23:59:59.999Z',
    });
    const sourceTakeWithInputs = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
    });
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/rollback-final.mp4',
      'rollback final video bytes'
    );
    await projectData.importShotVideoTake({
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/rollback-final.mp4',
      title: 'Rollback final',
    });
    const takeIdsBefore = (
      await projectData.listSceneShotVideoTakes({
        homeDir,
        sceneId: ids.sceneId,
      })
    ).takes.map((take) => take.take.takeId);

    await removeProjectFile(promptSheet.mediaInput.projectRelativePath);

    await expect(
      projectData.updateSceneShotVideoTakeProduction({
        homeDir,
        sceneId: ids.sceneId,
        takeId: sourceTakeId,
        production: {
          ...sourceTakeWithInputs.state.production,
          customPromptNote: 'Trigger a failed iteration copy.',
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_ASSET_FILE_SOURCE_NOT_FOUND' });

    const takeIdsAfter = (
      await projectData.listSceneShotVideoTakes({
        homeDir,
        sceneId: ids.sceneId,
      })
    ).takes.map((take) => take.take.takeId);
    expect(takeIdsAfter).toEqual(takeIdsBefore);
    await expect(
      projectFilesUnder('generated/media/scene-shot-video-takes')
    ).resolves.toEqual([]);
  });

  it('repairs already-shared active take-owned prompt sheet media', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceTakeId = written.take.takeId;
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/repair-prompt-sheet.png',
      'repair prompt sheet bytes'
    );
    await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/repair-prompt-sheet.png',
      title: 'Repair prompt sheet',
    });
    const sourceTakeWithPromptSheet = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
    });
    const sourceInput = (
      await projectData.listShotVideoTakeInputs({
        homeDir,
        takeId: sourceTakeId,
      })
    ).inputs.find((input) => input.kind === 'video-prompt-sheet');
    if (!sourceInput) {
      throw new Error('Expected source Video Prompt Sheet input.');
    }
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/repair-final.mp4',
      'repair final video bytes'
    );
    await projectData.importShotVideoTake({
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/repair-final.mp4',
      title: 'Repair final',
    });
    const continued = await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      production: {
        ...sourceTakeWithPromptSheet.state.production,
        requestedInputs: [
          {
            kind: 'video-prompt-sheet',
            subjectKind: 'take',
            subjectId: sourceTakeId,
          },
        ],
      },
    });
    const copiedInput = continued.mediaInputs.find(
      (input) => input.kind === 'video-prompt-sheet'
    );
    if (!copiedInput) {
      throw new Error('Expected copied Video Prompt Sheet input.');
    }
    corruptInputAssetFile({
      inputId: copiedInput.inputId,
      assetId: sourceInput.assetId,
      assetFileId: sourceInput.assetFileId,
    });
    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: continued.take.takeId,
      production: {
        ...continued.take.state.production,
        preparedInputs: [
          {
            kind: 'video-prompt-sheet',
            assetId: sourceInput.assetId,
            assetFileId: sourceInput.assetFileId,
            subjectKind: 'take',
            subjectId: continued.take.takeId,
          },
        ],
      },
    });
    await expect(
      projectData.deleteSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        takeId: continued.take.takeId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA440' });

    const repair = await projectData.repairShotVideoTakeOwnedMedia({
      homeDir,
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(repair.repairedInputs).toEqual([
      expect.objectContaining({
        inputId: copiedInput.inputId,
        takeId: continued.take.takeId,
        sourceAssetId: sourceInput.assetId,
        sourceAssetFileId: sourceInput.assetFileId,
      }),
    ]);
    const repairedInput = (
      await projectData.listShotVideoTakeInputs({
        homeDir,
        takeId: continued.take.takeId,
      })
    ).inputs.find((input) => input.inputId === copiedInput.inputId);
    expect(repairedInput).toEqual(
      expect.objectContaining({
        assetId: repair.repairedInputs[0]?.assetId,
        assetFileId: repair.repairedInputs[0]?.assetFileId,
        selected: true,
      })
    );
    const repairedTake = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: continued.take.takeId,
    });
    expect(repairedTake.state.production.preparedInputs).toEqual([
      expect.objectContaining({
        assetId: repair.repairedInputs[0]?.assetId,
        assetFileId: repair.repairedInputs[0]?.assetFileId,
        subjectId: continued.take.takeId,
      }),
    ]);

    await expect(
      projectData.deleteSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        takeId: continued.take.takeId,
      })
    ).resolves.toMatchObject({
      recovery: expect.objectContaining({
        trashItemIds: expect.any(Array),
      }),
    });
  });

  it('repairs unselected take-owned media without changing selected prepared input', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const takeId = written.take.takeId;
    const otherTakeReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      title: 'Shared prompt sheet owner',
    });
    const otherTakeId = otherTakeReport.overview.take.takeId;
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/selected-prompt-sheet.png',
      'selected prompt sheet'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/shared-prompt-sheet.png',
      'shared prompt sheet'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/unselected-prompt-sheet.png',
      'unselected prompt sheet'
    );

    const selected = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId,
      sourceProjectRelativePath: 'generated/media/selected-prompt-sheet.png',
      title: 'Selected prompt sheet',
    });
    const sharedOwner = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId: otherTakeId,
      sourceProjectRelativePath: 'generated/media/shared-prompt-sheet.png',
      title: 'Shared prompt sheet',
    });
    const unselected = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId,
      sourceProjectRelativePath: 'generated/media/unselected-prompt-sheet.png',
      title: 'Unselected prompt sheet',
      selection: 'take',
    });
    corruptInputAssetFile({
      inputId: unselected.mediaInput.inputId,
      assetId: sharedOwner.mediaInput.assetId,
      assetFileId: sharedOwner.mediaInput.assetFileId,
      createdAt: '9999-12-31T23:59:59.999Z',
    });

    const repair = await projectData.repairShotVideoTakeOwnedMedia({
      homeDir,
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(repair.repairedInputs).toEqual([
      expect.objectContaining({
        inputId: unselected.mediaInput.inputId,
        takeId,
        sourceAssetId: sharedOwner.mediaInput.assetId,
        sourceAssetFileId: sharedOwner.mediaInput.assetFileId,
      }),
    ]);
    const repairedInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId,
    });
    expect(repairedInputs.inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inputId: selected.mediaInput.inputId,
          assetId: selected.mediaInput.assetId,
          assetFileId: selected.mediaInput.assetFileId,
          selected: true,
        }),
        expect.objectContaining({
          inputId: unselected.mediaInput.inputId,
          assetId: repair.repairedInputs[0]?.assetId,
          assetFileId: repair.repairedInputs[0]?.assetFileId,
          selected: false,
        }),
      ])
    );
    const repairedTake = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId,
    });
    expect(repairedTake.state.production.preparedInputs).toEqual([
      expect.objectContaining({
        assetId: selected.mediaInput.assetId,
        assetFileId: selected.mediaInput.assetFileId,
        subjectId: takeId,
      }),
    ]);
  });

  it('repairs prepared-only unselected take-owned media references', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const takeId = written.take.takeId;
    const otherTakeReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      title: 'Prepared-only shared media owner',
    });
    const otherTakeId = otherTakeReport.overview.take.takeId;
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/prepared-only-selected-prompt-sheet.png',
      'prepared-only selected prompt sheet'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/prepared-only-shared-prompt-sheet.png',
      'prepared-only shared prompt sheet'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/prepared-only-unselected-prompt-sheet.png',
      'prepared-only unselected prompt sheet'
    );

    const selected = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId,
      sourceProjectRelativePath:
        'generated/media/prepared-only-selected-prompt-sheet.png',
      title: 'Prepared-only selected prompt sheet',
    });
    const sharedOwner = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId: otherTakeId,
      sourceProjectRelativePath:
        'generated/media/prepared-only-shared-prompt-sheet.png',
      title: 'Prepared-only shared prompt sheet',
    });
    const unselected = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId,
      sourceProjectRelativePath:
        'generated/media/prepared-only-unselected-prompt-sheet.png',
      title: 'Prepared-only unselected prompt sheet',
      selection: 'take',
    });
    corruptInputAssetFile({
      inputId: unselected.mediaInput.inputId,
      assetId: sharedOwner.mediaInput.assetId,
      assetFileId: sharedOwner.mediaInput.assetFileId,
      createdAt: '9999-12-31T23:59:59.999Z',
    });
    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId,
      production: {
        requestedInputs: [
          {
            kind: 'video-prompt-sheet',
            subjectKind: 'take',
            subjectId: takeId,
          },
        ],
        preparedInputs: [
          {
            kind: 'video-prompt-sheet',
            assetId: sharedOwner.mediaInput.assetId,
            assetFileId: sharedOwner.mediaInput.assetFileId,
            subjectKind: 'take',
            subjectId: takeId,
          },
        ],
      },
    });

    const repair = await projectData.repairShotVideoTakeOwnedMedia({
      homeDir,
      idGenerator: createDeterministicIdGenerator(),
    });

    expect(repair.repairedInputs).toEqual([
      expect.objectContaining({
        inputId: unselected.mediaInput.inputId,
        takeId,
        sourceAssetId: sharedOwner.mediaInput.assetId,
        sourceAssetFileId: sharedOwner.mediaInput.assetFileId,
      }),
    ]);
    const repairedInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId,
    });
    expect(repairedInputs.inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inputId: selected.mediaInput.inputId,
          assetId: selected.mediaInput.assetId,
          assetFileId: selected.mediaInput.assetFileId,
          selected: true,
        }),
        expect.objectContaining({
          inputId: unselected.mediaInput.inputId,
          assetId: repair.repairedInputs[0]?.assetId,
          assetFileId: repair.repairedInputs[0]?.assetFileId,
          selected: false,
        }),
      ])
    );
    const repairedTake = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId,
    });
    expect(repairedTake.state.production.preparedInputs).toEqual([
      expect.objectContaining({
        assetId: repair.repairedInputs[0]?.assetId,
        assetFileId: repair.repairedInputs[0]?.assetFileId,
        subjectId: takeId,
      }),
    ]);
  });

  it('ignores discarded take-owned media rows when deleting a take', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const takeId = written.take.takeId;
    const otherTakeReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
      title: 'Active shared media owner',
    });
    const otherTakeId = otherTakeReport.overview.take.takeId;
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/delete-selected-prompt-sheet.png',
      'selected prompt sheet'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/delete-shared-prompt-sheet.png',
      'shared prompt sheet'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/delete-discarded-prompt-sheet.png',
      'discarded prompt sheet'
    );

    await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId,
      sourceProjectRelativePath: 'generated/media/delete-selected-prompt-sheet.png',
      title: 'Selected prompt sheet',
    });
    const activeOwner = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId: otherTakeId,
      sourceProjectRelativePath: 'generated/media/delete-shared-prompt-sheet.png',
      title: 'Active shared prompt sheet',
    });
    const discarded = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId,
      sourceProjectRelativePath: 'generated/media/delete-discarded-prompt-sheet.png',
      title: 'Discarded prompt sheet',
      selection: 'take',
    });
    corruptInputAssetFile({
      inputId: discarded.mediaInput.inputId,
      assetId: activeOwner.mediaInput.assetId,
      assetFileId: activeOwner.mediaInput.assetFileId,
    });
    await projectData.deleteShotVideoTakeInput({
      homeDir,
      takeId,
      inputId: discarded.mediaInput.inputId,
    });

    await expect(
      projectData.deleteSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        takeId,
      })
    ).resolves.toMatchObject({
      recovery: expect.objectContaining({
        trashItemIds: expect.any(Array),
      }),
    });
    await expect(
      projectData.listShotVideoTakeInputs({
        homeDir,
        takeId: otherTakeId,
      })
    ).resolves.toMatchObject({
      inputs: [
        expect.objectContaining({
          inputId: activeOwner.mediaInput.inputId,
          assetId: activeOwner.mediaInput.assetId,
          selected: true,
        }),
      ],
    });
  });

  it('continues editing on a new take when composition changes after finalization', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceTakeId = written.take.takeId;
    await projectData.updateSceneShotVideoTakeDirection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      direction: {
        composition: {
          shotSize: 'wide-shot',
          customComposition: 'Hold the whole council chamber in the frame.',
        },
      },
    });
    await projectData.updateSceneShotVideoTakeProduction({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      production: {
        requestedInputs: [
          {
            kind: 'video-prompt-sheet',
            subjectKind: 'take',
            subjectId: sourceTakeId,
          },
        ],
      },
    });
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/first-composition-take.mp4',
      'first composition video'
    );
    await projectData.importShotVideoTake({
      homeDir,
      takeId: sourceTakeId,
      sourceProjectRelativePath: 'generated/media/first-composition-take.mp4',
      title: 'First composition take',
    });

    const continued = await projectData.updateSceneShotVideoTakeDirection({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
      direction: {
        composition: {
          shotSize: 'close-up',
          customComposition: 'Move into Mehmed and let the map fall soft.',
        },
      },
    });

    expect(continued.take.takeId).not.toBe(sourceTakeId);
    expect(continued.take.regeneratedFromTakeId).toBe(sourceTakeId);
    expect(
      continued.take.state.structure.mode === 'continuous'
        ? continued.take.state.structure.sharedDirection.composition
        : undefined
    ).toMatchObject({
      shotSize: 'close-up',
      customComposition: 'Move into Mehmed and let the map fall soft.',
    });
    expect(continued.take.state.production.requestedInputs).toEqual([
      expect.objectContaining({
        kind: 'video-prompt-sheet',
        subjectKind: 'take',
        subjectId: continued.take.takeId,
      }),
    ]);

    const sourceTake = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: sourceTakeId,
    });
    expect(sourceTake.video?.projectRelativePath).toMatch(
      /^shots\/.+\/take-for-shot-001-01\/video\.mp4$/
    );
    expect(
      sourceTake.state.structure.mode === 'continuous'
        ? sourceTake.state.structure.sharedDirection.composition
        : undefined
    ).toMatchObject({
      shotSize: 'wide-shot',
      customComposition: 'Hold the whole council chamber in the frame.',
    });
    expect(sourceTake.state.production.requestedInputs).toEqual([
      expect.objectContaining({
        subjectKind: 'take',
        subjectId: sourceTakeId,
      }),
    ]);
  });

  it('deletes editable takes through core-owned take deletion', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    const report = await projectData.deleteSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });

    expect(report.resourceKeys).toEqual(
      expect.arrayContaining([
        `surface:scene:${ids.sceneId}:takes`,
        `scene-shot-video-take:${written.take.takeId}`,
      ])
    );
    expect(report.recovery.trashItemIds).toHaveLength(1);
    await expect(
      projectData.readSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA419' });
  });

  it('keeps take trash restore and collection scoped to take-owned assets', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const takeOwnedPath = 'generated/media/take-trash-owned-prompt-sheet.png';
    const sceneOwnedPath = 'storyboards/the-young-sultan-s-obsession/a-throne-facing-an-ancient-city/00-iteration/take-trash-scene-reference.png';
    const replacedInputPath = 'generated/media/take-trash-replaced-input.png';

    await shotVideoTakeProject.writeProjectFile(
      takeOwnedPath,
      'take-owned prompt sheet'
    );
    await shotVideoTakeProject.writeProjectFile(
      sceneOwnedPath,
      'scene-owned reference'
    );
    await shotVideoTakeProject.writeProjectFile(
      replacedInputPath,
      'input that will point at the scene asset'
    );

    const takeOwnedInput = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: takeOwnedPath,
      title: 'Take-owned prompt sheet',
    });
    const sceneReferenceInput = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: replacedInputPath,
      title: 'Scene reference input',
      selection: 'take',
    });
    const sceneOwnedAsset = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: ids.sceneId },
      type: 'reference',
      mediaKind: 'image',
      title: 'Scene owned reference',
      projectRelativePath: sceneOwnedPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });
    const sceneOwnedFile = sceneOwnedAsset.files[0];
    if (!sceneOwnedFile) {
      throw new Error('Expected scene-owned asset to have a primary file.');
    }
    corruptInputAssetFile({
      inputId: sceneReferenceInput.mediaInput.inputId,
      assetId: sceneOwnedAsset.assetId,
      assetFileId: sceneOwnedFile.id,
    });

    const discardedTake = await projectData.deleteSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });
    const takeTrashItemId = discardedTake.recovery.restoreCommand.trashItemId;
    const discardedSceneAsset = await projectData.discardAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: ids.sceneId },
      assetId: sceneOwnedAsset.assetId,
    });
    const sceneAssetTrashItemId =
      discardedSceneAsset.recovery.restoreCommand.trashItemId;

    const preview = await projectData.previewGarbageCollection({
      projectName: 'constantinople',
      homeDir,
    });
    expect(preview.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trashItemId: takeTrashItemId,
          originalProjectRelativePath:
            takeOwnedInput.mediaInput.projectRelativePath,
        }),
        expect.objectContaining({
          trashItemId: sceneAssetTrashItemId,
          originalProjectRelativePath: sceneOwnedPath,
        }),
      ])
    );
    expect(preview.files).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trashItemId: takeTrashItemId,
          originalProjectRelativePath: sceneOwnedPath,
        }),
      ])
    );

    await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: takeTrashItemId,
    });
    await expect(
      projectData.listAssets({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'scene', sceneId: ids.sceneId },
      })
    ).resolves.toEqual([]);
  });

  it('restores a previously picked take as unpicked when another active take is picked', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    await projectData.updateSceneShotVideoTakePick({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
      picked: true,
    });
    const discarded = await projectData.deleteSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });
    const replacementReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
      title: 'Replacement picked take',
    });
    const replacement = replacementReport.overview.take;
    await projectData.updateSceneShotVideoTakePick({
      homeDir,
      sceneId: ids.sceneId,
      takeId: replacement.takeId,
      picked: true,
    });

    const restored = await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: discarded.recovery.restoreCommand.trashItemId,
    });

    expect(restored.warnings).toEqual([
      expect.objectContaining({
        code: 'PROJECT_DATA279',
        severity: 'warning',
      }),
    ]);
    await expect(
      projectData.readSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
      })
    ).resolves.toMatchObject({ picked: false });
    await expect(
      projectData.readSceneShotVideoTake({
        homeDir,
        sceneId: ids.sceneId,
        takeId: replacement.takeId,
      })
    ).resolves.toMatchObject({ picked: true });
  });
});
