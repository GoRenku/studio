import { beforeEach, describe, expect, it } from 'vitest';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../testing/shot-video-take-fixtures.js';

describe('shot video take preflight and validation', () => {
  let shotVideoTakeProject: ShotVideoTakeTestProject;
  let homeDir: string;
  let projectData: ShotVideoTakeTestProject['projectData'];

  beforeEach(async () => {
    shotVideoTakeProject = await createShotVideoTakeTestProject();
    homeDir = shotVideoTakeProject.homeDir;
    projectData = shotVideoTakeProject.projectData;
  });

  it('validates selected input ownership before mutating another Shot Video Take selection', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const otherTakeReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
    });
    const otherTake = otherTakeReport.overview.take;
    await shotVideoTakeProject.writeProjectFile('generated/media/group-two-a.png', 'first frame a');
    await shotVideoTakeProject.writeProjectFile('generated/media/group-two-b.png', 'first frame b');
    const selected = await projectData.importShotFirstFrame({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/group-two-a.png',
      selection: 'select',
    });
    const unselected = await projectData.importShotFirstFrame({
      homeDir,
      takeId: otherTake.takeId,
      sourceProjectRelativePath: 'generated/media/group-two-b.png',
      selection: 'take',
    });

    await expect(
      projectData.selectShotVideoTakeInput({
        homeDir,
      takeId: written.take.takeId,
        inputId: unselected.mediaInput.inputId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA362' });

    const firstTakeInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId: written.take.takeId,
    });
    expect(firstTakeInputs.inputs.find((input) => input.inputId === selected.mediaInput.inputId))
      .toMatchObject({ selected: true });
    const otherTakeInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId: otherTake.takeId,
    });
    expect(otherTakeInputs.inputs.find((input) => input.inputId === unselected.mediaInput.inputId))
      .toMatchObject({ selected: false });
  });

  it('rejects wrong-scene input selection before changing the selected input', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/unselected-first-frame.png',
      'first frame'
    );
    const imported = await projectData.importShotFirstFrame({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/unselected-first-frame.png',
      selection: 'take',
    });

    await expect(
      projectData.selectShotVideoTakeInput({
        homeDir,
        sceneId: 'scene_wrong',
        takeId: written.take.takeId,
        inputId: imported.mediaInput.inputId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA423' });

    const inputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId: written.take.takeId,
    });
    expect(
      inputs.inputs.find(
        (input) => input.inputId === imported.mediaInput.inputId
      )
    ).toMatchObject({ selected: false });
  });

  it('rejects wrong-scene input clear before changing prepared input state', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/selected-first-frame.png',
      'first frame'
    );
    const imported = await projectData.importShotFirstFrame({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/selected-first-frame.png',
      selection: 'select',
    });

    await expect(
      projectData.clearShotVideoTakeInputSelection({
        homeDir,
        sceneId: 'scene_wrong',
        takeId: written.take.takeId,
        kind: imported.mediaInput.kind,
        subjectKind: imported.mediaInput.subjectKind,
        subjectId: imported.mediaInput.subjectId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA423' });

    const inputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId: written.take.takeId,
    });
    expect(
      inputs.inputs.find(
        (input) => input.inputId === imported.mediaInput.inputId
      )
    ).toMatchObject({ selected: true });
    const take = await projectData.readSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      takeId: written.take.takeId,
    });
    expect(take.state.production.preparedInputs).toEqual([
      expect.objectContaining({
        assetFileId: imported.mediaInput.assetFileId,
      }),
    ]);
  });

  it('rejects wrong-scene input deletion before deleting metadata or files', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const sourcePath = 'generated/media/delete-first-frame.png';
    await shotVideoTakeProject.writeProjectFile(sourcePath, 'first frame');
    const imported = await projectData.importShotFirstFrame({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: sourcePath,
      selection: 'select',
    });

    await expect(
      projectData.deleteShotVideoTakeInput({
        homeDir,
        sceneId: 'scene_wrong',
        takeId: written.take.takeId,
        inputId: imported.mediaInput.inputId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA423' });

    const inputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId: written.take.takeId,
    });
    expect(
      inputs.inputs.find(
        (input) => input.inputId === imported.mediaInput.inputId
      )
    ).toMatchObject({ selected: true });
    await expect(
      shotVideoTakeProject.projectFileExists(
        imported.mediaInput.projectRelativePath
      )
    ).resolves.toBe(true);
  });

  it('rejects wrong-scene input file resolution before returning a file path', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/file-serving-first-frame.png',
      'first frame'
    );
    const imported = await projectData.importShotFirstFrame({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/file-serving-first-frame.png',
      selection: 'select',
    });

    await expect(
      projectData.resolveShotVideoTakeInputFile({
        projectName: 'constantinople',
        homeDir,
        sceneId: 'scene_wrong',
        takeId: written.take.takeId,
        inputId: imported.mediaInput.inputId,
        assetFileId: imported.mediaInput.assetFileId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA423' });
  });



  it('preserves input shot membership when the Shot Video Take shot ids change', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const takeReport = await projectData.createSceneShotVideoTake({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
    });
    const take = takeReport.overview.take;
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/shot-one-first-frame.png',
      'shot one first frame'
    );
    const imported = await projectData.importShotFirstFrame({
      homeDir,
      takeId: take.takeId,
      sourceProjectRelativePath: 'generated/media/shot-one-first-frame.png',
      selection: 'select',
    });

    await projectData.updateSceneShotVideoTakeShots({
      homeDir,
      takeId: take.takeId,
      shotIds: ['shot_002'],
    });

    const shotTwoInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId: take.takeId,
    });
    expect(shotTwoInputs.inputs).toHaveLength(0);

    await projectData.updateSceneShotVideoTakeShots({
      homeDir,
      takeId: take.takeId,
      shotIds: ['shot_001'],
    });

    const shotOneInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId: take.takeId,
    });
    expect(shotOneInputs.inputs).toEqual([
      expect.objectContaining({
        inputId: imported.mediaInput.inputId,
        shotIds: ['shot_001'],
      }),
    ]);
  });

  it('deletes an input take and promotes another matching take when selected', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await shotVideoTakeProject.writeProjectFile('generated/media/reference-a.png', 'reference a');
    await shotVideoTakeProject.writeProjectFile('generated/media/reference-b.png', 'reference b');
    const selected = await projectData.importShotReferenceImage({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/reference-a.png',
      selection: 'select',
    });
    const unselected = await projectData.importShotReferenceImage({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/reference-b.png',
      selection: 'take',
    });

    const deleted = await projectData.deleteShotVideoTakeInput({
      homeDir,
      takeId: written.take.takeId,
      inputId: selected.mediaInput.inputId,
    });
    expect(deleted.recovery?.trashItemIds).toHaveLength(1);

    const inputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId: written.take.takeId,
    });
    expect(inputs.inputs).toHaveLength(1);
    expect(inputs.inputs[0]).toMatchObject({
      inputId: unselected.mediaInput.inputId,
      selected: true,
    });
    await expect(shotVideoTakeProject.projectFileExists('generated/media/reference-a.png')).resolves.toBe(
      true
    );
  });

  it('restores a selected input as unselected when another active input owns the selection', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await shotVideoTakeProject.writeProjectFile('generated/media/restore-reference-a.png', 'reference a');
    await shotVideoTakeProject.writeProjectFile('generated/media/restore-reference-b.png', 'reference b');
    const selected = await projectData.importShotReferenceImage({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/restore-reference-a.png',
      selection: 'select',
    });
    const promoted = await projectData.importShotReferenceImage({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/restore-reference-b.png',
      selection: 'take',
    });

    const discarded = await projectData.deleteShotVideoTakeInput({
      homeDir,
      takeId: written.take.takeId,
      inputId: selected.mediaInput.inputId,
    });
    const restored = await projectData.restoreTrashItem({
      projectName: 'constantinople',
      homeDir,
      trashItemId: discarded.recovery!.restoreCommand.trashItemId,
    });

    expect(restored.warnings).toEqual([
      expect.objectContaining({
        code: 'PROJECT_DATA279',
        severity: 'warning',
      }),
    ]);
    const inputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId: written.take.takeId,
    });
    expect(inputs.inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inputId: selected.mediaInput.inputId,
          selected: false,
        }),
        expect.objectContaining({
          inputId: promoted.mediaInput.inputId,
          selected: true,
        }),
      ])
    );
  });
});
