import { beforeEach, describe, expect, it } from 'vitest';
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

  it('imports final shot video outputs with stable output records', async () => {
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
      output: {
        shotIds: ['shot_001'],
        selected: true,
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

  it('rejects deleting assets retained by take media inputs and outputs', async () => {
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
      projectData.deleteAsset({
        homeDir,
        projectName: 'constantinople',
        target: { kind: 'project' },
        assetId: mediaInputReport.imported.assetId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA421' });
    await expect(
      projectData.deleteAsset({
        homeDir,
        projectName: 'constantinople',
        target: { kind: 'project' },
        assetId: outputReport.imported.assetId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA421' });
  });
});
