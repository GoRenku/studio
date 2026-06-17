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

  it('validates selected input ownership before mutating another take generation selection', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const otherTakeGeneration = await projectData.createSceneShotVideoTakeGeneration({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_002'],
    });
    await shotVideoTakeProject.writeProjectFile('generated/media/group-two-a.png', 'first frame a');
    await shotVideoTakeProject.writeProjectFile('generated/media/group-two-b.png', 'first frame b');
    const selected = await projectData.importShotFirstFrame({
      homeDir,
      takeGenerationId: written.takeGeneration.takeGenerationId,
      sourceProjectRelativePath: 'generated/media/group-two-a.png',
      selection: 'select',
    });
    const unselected = await projectData.importShotFirstFrame({
      homeDir,
      takeGenerationId: otherTakeGeneration.takeGenerationId,
      sourceProjectRelativePath: 'generated/media/group-two-b.png',
      selection: 'take',
    });

    await expect(
      projectData.selectShotVideoTakeInput({
        homeDir,
      takeGenerationId: written.takeGeneration.takeGenerationId,
        inputId: unselected.input.inputId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA362' });

    const firstGenerationInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeGenerationId: written.takeGeneration.takeGenerationId,
    });
    expect(firstGenerationInputs.inputs.find((input) => input.inputId === selected.input.inputId))
      .toMatchObject({ selected: true });
    const otherGenerationInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeGenerationId: otherTakeGeneration.takeGenerationId,
    });
    expect(otherGenerationInputs.inputs.find((input) => input.inputId === unselected.input.inputId))
      .toMatchObject({ selected: false });
  });

  it('deletes an input take and promotes another matching take when selected', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await shotVideoTakeProject.writeProjectFile('generated/media/reference-a.png', 'reference a');
    await shotVideoTakeProject.writeProjectFile('generated/media/reference-b.png', 'reference b');
    const selected = await projectData.importShotReferenceImage({
      homeDir,
      takeGenerationId: written.takeGeneration.takeGenerationId,
      sourceProjectRelativePath: 'generated/media/reference-a.png',
      selection: 'select',
    });
    const unselected = await projectData.importShotReferenceImage({
      homeDir,
      takeGenerationId: written.takeGeneration.takeGenerationId,
      sourceProjectRelativePath: 'generated/media/reference-b.png',
      selection: 'take',
    });

    await projectData.deleteShotVideoTakeInput({
      homeDir,
      takeGenerationId: written.takeGeneration.takeGenerationId,
      inputId: selected.input.inputId,
    });

    const inputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeGenerationId: written.takeGeneration.takeGenerationId,
    });
    expect(inputs.inputs).toHaveLength(1);
    expect(inputs.inputs[0]).toMatchObject({
      inputId: unselected.input.inputId,
      selected: true,
    });
    await expect(shotVideoTakeProject.projectFileExists('generated/media/reference-a.png')).resolves.toBe(
      false
    );
  });
});
