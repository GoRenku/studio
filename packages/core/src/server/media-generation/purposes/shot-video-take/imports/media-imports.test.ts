import { beforeEach, describe, expect, it } from 'vitest';
import type {
  ImageEditGenerationSpec,
  ProjectRelativePath,
} from '../../../../../client/index.js';
import { createDeterministicIdGenerator } from '../../../../index.js';
import {
  insertShotVideoTakeInputRecord,
  insertShotVideoTakeVideoRecord,
} from '../../../../database/access/shot-video-takes.js';
import { openProjectSession } from '../../../../database/lifecycle/active-session.js';
import {
  createShotVideoTakeTestProject,
  type ShotVideoTakeTestProject,
} from '../../../../testing/shot-video-take-fixtures.js';
import { createTestAssetFixture } from '../../../../testing/asset-fixture-helpers.js';

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

    const report = await projectData.importShotInputMedia({
      inputKind: 'first-frame',
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath,
      title: 'Imported first frame',
    });

    expect(report).toMatchObject({
      valid: true,
      purpose: 'shot.input',
      imported: {
        title: 'Imported first frame',
        mediaKind: 'image',
      },
      mediaInput: {
        kind: 'first-frame',
        selected: true,
        projectRelativePath: expect.stringMatching(
          /^shots\/the-young-sultan-s-obsession\/a-throne-facing-an-ancient-city\/take-for-shot-001-01\/first-frame\.png$/
        ),
        shotIds: ['shot_001'],
      },
    });
    expect(report.imported.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'primary',
          mediaKind: 'image',
          projectRelativePath: expect.stringMatching(
            /^shots\/the-young-sultan-s-obsession\/a-throne-facing-an-ancient-city\/take-for-shot-001-01\/first-frame\.png$/
          ),
        }),
      ])
    );
  });

  it('rejects non-image shot input import kinds before writing media input rows', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);

    await expect(
      projectData.importShotInputMedia({
        inputKind: 'audio' as never,
        homeDir,
        takeId: written.take.takeId,
        sourceProjectRelativePath: 'generated/media/dialogue.mp3',
        title: 'Dialogue reference',
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_INPUT_IMPORT_KIND_UNSUPPORTED',
    });

    await expect(
      projectData.listShotVideoTakeInputs({
        homeDir,
        takeId: written.take.takeId,
      })
    ).resolves.toMatchObject({ inputs: [] });
  });

  it('replaces a selected prompt sheet with a simulated image edit run receipt', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const sourceProjectRelativePath = 'generated/media/video-prompt-sheet.png';
    await shotVideoTakeProject.writeProjectFile(
      sourceProjectRelativePath,
      'video prompt sheet'
    );

    const selectedPromptSheet = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath,
      title: 'Video prompt sheet',
    });
    const imageEditSpec: ImageEditGenerationSpec = {
      purpose: 'image.edit',
      target: { kind: 'asset', id: selectedPromptSheet.imported.assetId },
      sourceAssetFileId: selectedPromptSheet.mediaInput.assetFileId,
      modelChoice: 'fal-ai/openai/gpt-image-2/edit',
      prompt: 'Preserve the sheet and adjust only the requested panels.',
      parameterValues: {
        image_size: { width: 1024, height: 768 },
        quality: 'high',
        output_format: 'png',
        num_images: 1,
      },
      title: 'Prompt sheet correction',
    };
    const specRecord = await projectData.createMediaGenerationSpec({
      homeDir,
      spec: imageEditSpec,
      idGenerator: createDeterministicIdGenerator(),
    });
    const imageEditRun = await projectData.runMediaGenerationSpec({
      homeDir,
      specId: specRecord.id,
      simulate: true,
      idGenerator: createDeterministicIdGenerator(),
    });
    const editedOutput = firstProjectRelativeOutputPath(imageEditRun.run.outputs);

    const correctedPromptSheet = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: editedOutput,
      title: 'Corrected video prompt sheet',
      receipt: imageEditRun,
      replaceSelected: true,
    });

    expect(correctedPromptSheet.mediaInput).toMatchObject({
      kind: 'video-prompt-sheet',
      selected: true,
      subjectKind: 'take',
      subjectId: written.take.takeId,
      mediaGenerationRunId: imageEditRun.run.id,
    });
    expect(correctedPromptSheet.replacedInput).toMatchObject({
      inputId: selectedPromptSheet.mediaInput.inputId,
    });
    expect(correctedPromptSheet.changes).toEqual(
      expect.arrayContaining([
        {
          type: 'shotVideoTakeInput.discarded',
          inputId: selectedPromptSheet.mediaInput.inputId,
        },
      ])
    );

    const activeInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId: written.take.takeId,
    });
    expect(activeInputs.inputs).toEqual([
      expect.objectContaining({
        inputId: correctedPromptSheet.mediaInput.inputId,
        selected: true,
        mediaGenerationRunId: imageEditRun.run.id,
      }),
    ]);
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
          projectRelativePath: expect.stringMatching(/^shots\/.+\/video\.mp4$/),
          mimeType: 'video/mp4',
        },
      },
      createdRegeneratedTake: false,
      video: {
        takeId: written.take.takeId,
        projectRelativePath: expect.stringMatching(/^shots\/.+\/video\.mp4$/),
        mimeType: 'video/mp4',
      },
    });
    expect(report.imported.files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'primary',
          mediaKind: 'video',
          mimeType: 'video/mp4',
          projectRelativePath: expect.stringMatching(/^shots\/.+\/video\.mp4$/),
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
      projectRelativePath: expect.stringMatching(/^shots\/.+\/second-final-take-02\/video\.mp4$/),
    });
    expect(firstReport.take.video).toMatchObject({
      takeId: written.take.takeId,
      projectRelativePath: expect.stringMatching(/^shots\/.+\/take-for-shot-001-01\/video\.mp4$/),
    });

    const sourceTake = await projectData.readSceneShotVideoTake({
      homeDir,
      takeId: written.take.takeId,
    });
    expect(sourceTake.video).toMatchObject({
      projectRelativePath: expect.stringMatching(/^shots\/.+\/take-for-shot-001-01\/video\.mp4$/),
    });
  });

  it('copies selected take-scoped inputs onto the regenerated take during repeat finalization', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/video-prompt-sheet.png',
      'video prompt sheet'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/source-video-take.mp4',
      'source video take'
    );
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/regenerated-video-take.mp4',
      'regenerated video take'
    );

    const promptSheet = await projectData.importShotInputMedia({
      inputKind: 'video-prompt-sheet',
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/video-prompt-sheet.png',
      title: 'Video prompt sheet',
    });
    expect(promptSheet.mediaInput).toMatchObject({
      kind: 'video-prompt-sheet',
      selected: true,
      subjectKind: 'take',
      subjectId: written.take.takeId,
    });
    await projectData.importShotVideoTake({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/source-video-take.mp4',
      title: 'Source video take',
    });

    const regenerated = await projectData.importShotVideoTake({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/regenerated-video-take.mp4',
      title: 'Regenerated video take',
    });

    expect(regenerated.createdRegeneratedTake).toBe(true);
    const regeneratedInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId: regenerated.take.takeId,
    });
    expect(regeneratedInputs.inputs).toEqual([
      expect.objectContaining({
        kind: 'video-prompt-sheet',
        selected: true,
        subjectKind: 'take',
        subjectId: regenerated.take.takeId,
      }),
    ]);
    expect(regeneratedInputs.inputs[0]?.assetId).not.toBe(
      promptSheet.mediaInput.assetId
    );
    expect(regeneratedInputs.inputs[0]?.assetFileId).not.toBe(
      promptSheet.mediaInput.assetFileId
    );
    expect(regeneratedInputs.inputs[0]?.projectRelativePath).toMatch(
      /^shots\/.+\/regenerated-video-take-02\/video-prompt-sheet\.png$/
    );
    const sourceInputs = await projectData.listShotVideoTakeInputs({
      homeDir,
      takeId: written.take.takeId,
    });
    expect(sourceInputs.inputs).toEqual([
      expect.objectContaining({
        kind: 'video-prompt-sheet',
        selected: true,
        subjectKind: 'take',
        subjectId: written.take.takeId,
      }),
    ]);
  });

  it('validates a replacement video source before creating a regenerated take', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    await shotVideoTakeProject.writeProjectFile(
      'generated/media/existing-final-take.mp4',
      'existing final video'
    );
    await projectData.importShotVideoTake({
      homeDir,
      takeId: written.take.takeId,
      sourceProjectRelativePath: 'generated/media/existing-final-take.mp4',
      title: 'Existing final take',
    });
    const before = await projectData.listSceneShotVideoTakes({
      homeDir,
      sceneId: ids.sceneId,
    });

    await expect(
      projectData.importShotVideoTake({
        homeDir,
        takeId: written.take.takeId,
        sourceProjectRelativePath: 'generated/media/missing-final-take.mp4',
        title: 'Missing final take',
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_ASSET_FILE_SOURCE_NOT_FOUND',
    });

    const after = await projectData.listSceneShotVideoTakes({
      homeDir,
      sceneId: ids.sceneId,
    });
    expect(after.takes.map((take) => take.take.takeId)).toEqual(
      before.takes.map((take) => take.take.takeId)
    );
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
    const mediaInputReport = await projectData.importShotInputMedia({
      inputKind: 'first-frame',
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
    const inputPath = 'shots/the-young-sultan-s-obsession/a-throne-facing-an-ancient-city/attached-first-frame-01/first-frame.png';
    const outputPath = 'shots/the-young-sultan-s-obsession/a-throne-facing-an-ancient-city/attached-final-take-01/video.mp4';
    await shotVideoTakeProject.writeProjectFile(inputPath, 'first frame');
    await shotVideoTakeProject.writeProjectFile(outputPath, 'final video');

    const inputAsset = await createTestAssetFixture({
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
    const outputAsset = await createTestAssetFixture({
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
    ).resolves.toMatchObject({ valid: true });
    await expect(
      projectData.discardAsset({
        homeDir,
        projectName: 'constantinople',
        target: { kind: 'scene', sceneId: ids.sceneId },
        assetId: outputAsset.assetId,
      })
    ).resolves.toMatchObject({ valid: true });
  });
});

function firstProjectRelativeOutputPath(outputs: unknown): ProjectRelativePath {
  if (!Array.isArray(outputs)) {
    throw new Error('Expected generation outputs array.');
  }
  const output = outputs.find(
    (candidate): candidate is { projectRelativePath: ProjectRelativePath } =>
      Boolean(
        candidate &&
          typeof candidate === 'object' &&
          typeof (candidate as { projectRelativePath?: unknown }).projectRelativePath ===
            'string'
      )
  );
  if (!output) {
    throw new Error('Expected generation output with projectRelativePath.');
  }
  return output.projectRelativePath;
}
