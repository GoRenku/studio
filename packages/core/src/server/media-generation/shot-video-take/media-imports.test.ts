import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectRelativePath } from '../../../client/index.js';
import {
  insertShotVideoTakeInputRecord,
  insertShotVideoTakeVideoRecord,
} from '../../database/access/shot-video-takes.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../testing/shot-video-take-fixtures.js';

describe('shot video take media imports', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('imports first-frame media with stable asset, file, and media input records', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceProjectRelativePath = 'generated/media/first-frame.png';
    await shotVideoTakeProject.writeProjectFile(sourceProjectRelativePath, 'first frame');

    const report = await projectData.importShotFirstFrame({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath,
      title: 'Imported first frame',
    });

    expect(report).toMatchObject({
      valid: true,
      purpose: 'shot.first-frame',
      imported: {
        title: 'Imported first frame',
        mediaKind: 'image',
      },
      mediaInput: {
        kind: 'first-frame',
        selected: true,
        projectRelativePath: sourceProjectRelativePath,
        shotIds: ['shot_001'],
      },
    });
    expect(report.imported.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'primary',
          mediaKind: 'image',
          projectRelativePath: sourceProjectRelativePath,
        }),
      ])
    );
  });

  it('finalizes a first shot video on the draft take', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceProjectRelativePath = 'generated/media/final-take.mp4';
    await shotVideoTakeProject.writeProjectFile(sourceProjectRelativePath, 'final video');

    const report = await projectData.importShotVideoTake({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath,
      title: 'Imported final take',
    });

    expect(report).toMatchObject({
      valid: true,
      purpose: 'shot.video-take',
      imported: {
        title: 'Imported final take',
        mediaKind: 'video',
      },
      sourceTake: {
        takeId: written.take.takeId,
      },
      take: {
        takeId: written.take.takeId,
        video: {
          projectRelativePath: sourceProjectRelativePath,
          mimeType: 'video/mp4',
        },
      },
      createdRegeneratedTake: false,
      video: {
        takeId: written.take.takeId,
        projectRelativePath: sourceProjectRelativePath,
        mimeType: 'video/mp4',
      },
    });
    expect(report.imported.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'primary',
          mediaKind: 'video',
          mimeType: 'video/mp4',
          projectRelativePath: sourceProjectRelativePath,
        }),
      ])
    );
  });

  it('finalizing another video from a videoed take creates a regenerated take', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/first-final-take.mp4',
      'first final video'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/second-final-take.mp4',
      'second final video'
    );

    const firstReport = await projectData.importShotVideoTake({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/first-final-take.mp4',
      title: 'First final take',
    });
    const secondReport = await projectData.importShotVideoTake({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/second-final-take.mp4',
      title: 'Second final take',
    });

    expect(secondReport.createdRegeneratedTake).toBe(true);
    expect(secondReport.sourceTake.takeId).toBe(written.take.takeId);
    expect(secondReport.take.takeId).not.toBe(written.take.takeId);
    expect(secondReport.take.regeneratedFromTakeId).toBe(written.take.takeId);
    expect(secondReport.take.shotIds).toEqual(written.take.shotIds);
    expect(secondReport.take.video).toMatchObject({
      takeId: secondReport.take.takeId,
      projectRelativePath: 'generated/media/second-final-take.mp4',
    });
    expect(firstReport.take.video).toMatchObject({
      takeId: written.take.takeId,
      projectRelativePath: 'generated/media/first-final-take.mp4',
    });

    const sourceTake = await projectData.readSceneShotVideoTake({
      homeDir,
      takeId: written.take.takeId,
    });
    expect(sourceTake.video).toMatchObject({
      projectRelativePath: 'generated/media/first-final-take.mp4',
    });
  });

  it('rejects deleting assets retained by take media inputs and videos', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/first-frame.png',
      'first frame'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/final-take.mp4',
      'final video'
    );
    const mediaInputReport = await projectData.importShotFirstFrame({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/first-frame.png',
      title: 'Imported first frame',
    });
    const outputReport = await projectData.importShotVideoTake({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/final-take.mp4',
      title: 'Imported final take',
    });

    await expect(
      projectData.discardAsset({
        homeDir,
        projectName: 'constantinople',
        target: { kind: 'project' },
        assetId: mediaInputReport.imported.assetId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA421' });
    await expect(
      projectData.discardAsset({
        homeDir,
        projectName: 'constantinople',
        target: { kind: 'project' },
        assetId: outputReport.imported.assetId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA421' });
  });


  it('ignores take media references after the owning take is discarded', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const inputPath = 'generated/media/attached-first-frame.png';
    const outputPath = 'generated/media/attached-final-take.mp4';
    await shotVideoTakeProject.writeProjectFile(inputPath, 'first frame');
    await shotVideoTakeProject.writeProjectFile(outputPath, 'final video');

    const inputAsset = await projectData.registerAsset({
      homeDir,
      projectName: 'constantinople',
      target: { kind: 'scene', sceneId: ids.sceneId },
      type: 'reference',
      mediaKind: 'image',
      title: 'Attached first frame',
      projectRelativePath: inputPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });
    const outputAsset = await projectData.registerAsset({
      homeDir,
      projectName: 'constantinople',
      target: { kind: 'scene', sceneId: ids.sceneId },
      type: 'shot-video-take',
      mediaKind: 'video',
      title: 'Attached final take',
      projectRelativePath: outputPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'reference',
    });
    const inputFile = inputAsset.files[0];
    const outputFile = outputAsset.files[0];
    if (!inputFile || !outputFile) {
      throw new Error('Expected registered assets to have primary files.');
    }

    const shotIds = ['shot_001'];
    const firstShotId = shotIds[0]!;
    const { session } = await openProjectSession({
      homeDir,
      projectName: 'constantinople',
    });
    try {
      const now = new Date().toISOString();
      insertShotVideoTakeInputRecord(session, {
        id: 'scene_shot_video_take_media_input_attached_asset',
        sceneId: ids.sceneId,
        takeId: written.take.takeId,
        inputKind: 'first-frame',
        subjectKind: 'shot',
        subjectId: firstShotId,
        assetId: inputAsset.assetId,
        assetFileId: inputFile.id,
        selection: 'take',
        shotIds,
        now,
      });
      insertShotVideoTakeVideoRecord(session, {
        takeId: written.take.takeId,
        assetId: outputAsset.assetId,
        assetFileId: outputFile.id,
        now,
      });
    } finally {
      session.close();
    }

    await expect(
      projectData.discardAsset({
        homeDir,
        projectName: 'constantinople',
        target: { kind: 'scene', sceneId: ids.sceneId },
        assetId: inputAsset.assetId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA421' });
    await expect(
      projectData.discardAsset({
        homeDir,
        projectName: 'constantinople',
        target: { kind: 'scene', sceneId: ids.sceneId },
        assetId: outputAsset.assetId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA421' });

    await projectData.deleteSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });

    await expect(
      projectData.discardAsset({
        homeDir,
        projectName: 'constantinople',
        target: { kind: 'scene', sceneId: ids.sceneId },
        assetId: inputAsset.assetId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA078' });
    await expect(
      projectData.discardAsset({
        homeDir,
        projectName: 'constantinople',
        target: { kind: 'scene', sceneId: ids.sceneId },
        assetId: outputAsset.assetId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA078' });
  });
});
