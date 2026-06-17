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

  it('imports first-frame media with stable asset, file, and input records', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceProjectRelativePath = 'generated/media/first-frame.png';
    await shotVideoTakeProject.writeProjectFile(sourceProjectRelativePath, 'first frame');

    const report = await projectData.importShotFirstFrame({
      homeDir,
      takeGenerationId: written.takeGeneration.takeGenerationId,
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
      input: {
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

  it('imports final shot video takes with stable take records', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourceProjectRelativePath = 'generated/media/final-take.mp4';
    await shotVideoTakeProject.writeProjectFile(sourceProjectRelativePath, 'final video');

    const report = await projectData.importShotVideoTake({
      homeDir,
      takeGenerationId: written.takeGeneration.takeGenerationId,
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
      take: {
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
});
