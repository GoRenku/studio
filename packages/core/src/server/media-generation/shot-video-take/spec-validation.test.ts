import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectRelativePath } from '../../../client/index.js';
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

  it('rejects a multi-shot final spec without the required storyboard sheet', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 2);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001', 'shot_002'],
    });

    await expect(
      projectData.validateShotVideoTakeSpec({
        homeDir,
        spec: {
          purpose: 'shot.video-take',
          target: context.target,
          inputModeId: 'reference',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          prompt: 'One continuous two-shot video take.',
          parameterValues: {},
          inputs: [],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA384',
      message: expect.stringContaining('multi-shot-storyboard-sheet'),
    });
  });

  it('rejects dialogue audio inputs when the selected route has no audio slot', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
    });

    await expect(
      projectData.validateShotVideoTakeSpec({
        homeDir,
        spec: {
          purpose: 'shot.video-take',
          target: context.target,
          inputModeId: 'text-only',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          prompt: 'One video take with unsupported dialogue audio.',
          parameterValues: {},
          inputs: [
            dialogueAudioInput('audio_file_001', 'generated/audio/dialogue-001.mp3'),
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_UNSUPPORTED',
    });
  });

  it('rejects dialogue audio inputs above the selected route max count', async () => {
    const ids = await shotVideoTakeProject.sampleIds();
    const written = await shotVideoTakeProject.writeShotList(ids, 1);
    const context = await projectData.buildShotVideoTakeContext({
      homeDir,
      sceneId: ids.sceneId,
      shotListId: written.shotList.id,
      shotIds: ['shot_001'],
    });

    await expect(
      projectData.validateShotVideoTakeSpec({
        homeDir,
        spec: {
          purpose: 'shot.video-take',
          target: context.target,
          inputModeId: 'reference',
          modelChoice: 'fal-ai/bytedance/seedance-2.0',
          prompt: 'One video take with too many dialogue audio references.',
          parameterValues: {},
          inputs: [
            dialogueAudioInput('audio_file_001', 'generated/audio/dialogue-001.mp3'),
            dialogueAudioInput('audio_file_002', 'generated/audio/dialogue-002.mp3'),
            dialogueAudioInput('audio_file_003', 'generated/audio/dialogue-003.mp3'),
            dialogueAudioInput('audio_file_004', 'generated/audio/dialogue-004.mp3'),
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_MAX_COUNT_EXCEEDED',
    });
  });
});

function dialogueAudioInput(assetFileId: string, projectRelativePath: string) {
  return {
    kind: 'audio' as const,
    assetId: 'asset_dialogue_001',
    assetFileId,
    role: 'dialogue_audio',
    mediaKind: 'audio' as const,
    projectRelativePath: projectRelativePath as ProjectRelativePath,
    subjectKind: 'scene-dialogue' as const,
    subjectId: assetFileId,
  };
}
