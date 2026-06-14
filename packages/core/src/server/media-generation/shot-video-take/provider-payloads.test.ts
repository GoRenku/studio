import { describe, expect, it } from 'vitest';
import {
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
  type ProjectRelativePath,
  type SceneShotMediaGenerationTarget,
  type ShotVideoTakeGenerationContext,
  type ShotVideoTakeGenerationSpec,
} from '../../../client/index.js';
import { buildShotVideoTakeProviderPayload } from './provider-payloads.js';

describe('shot video take provider payloads', () => {
  it('maps selected dialogue audio references to deduplicated provider audio input files', () => {
    const target: SceneShotMediaGenerationTarget = {
      kind: 'sceneShotGroup',
      id: 'scene_001:shot_list_001:group_001',
      sceneId: 'scene_001',
      shotListId: 'shot_list_001',
      productionGroupId: 'group_001',
      shotIds: ['shot_001'],
    };
    const spec: ShotVideoTakeGenerationSpec = {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      target,
      inputModeId: 'reference',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      prompt: 'Generate the shot with dialogue audio reference.',
      parameterValues: { duration: 6 },
      inputs: [
        dialogueAudioInput('audio_file_001', 'generated/audio/dialogue-001.mp3'),
        dialogueAudioInput('audio_file_001_copy', 'generated/audio/dialogue-001.mp3'),
      ],
    };

    const plan = buildShotVideoTakeProviderPayload(spec, {
      shotGroupMode: 'single-shot',
    } as ShotVideoTakeGenerationContext);

    expect(plan.inputFiles).toEqual([
      {
        field: 'audio_urls',
        projectRelativePath: 'generated/audio/dialogue-001.mp3',
        mediaKind: 'audio',
        asArray: true,
        required: false,
      },
    ]);
  });

  it('rejects provider payloads with more dialogue audio inputs than the route allows', () => {
    const target: SceneShotMediaGenerationTarget = {
      kind: 'sceneShotGroup',
      id: 'scene_001:shot_list_001:group_001',
      sceneId: 'scene_001',
      shotListId: 'shot_list_001',
      productionGroupId: 'group_001',
      shotIds: ['shot_001'],
    };
    const spec: ShotVideoTakeGenerationSpec = {
      purpose: SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
      target,
      inputModeId: 'reference',
      modelChoice: 'fal-ai/bytedance/seedance-2.0',
      prompt: 'Generate the shot with too many dialogue audio references.',
      parameterValues: { duration: 6 },
      inputs: [
        dialogueAudioInput('audio_file_001', 'generated/audio/dialogue-001.mp3'),
        dialogueAudioInput('audio_file_002', 'generated/audio/dialogue-002.mp3'),
        dialogueAudioInput('audio_file_003', 'generated/audio/dialogue-003.mp3'),
        dialogueAudioInput('audio_file_004', 'generated/audio/dialogue-004.mp3'),
      ],
    };

    expect(() =>
      buildShotVideoTakeProviderPayload(spec, {
        shotGroupMode: 'single-shot',
      } as ShotVideoTakeGenerationContext)
    ).toThrow(
      expect.objectContaining({
        code: 'CORE_SHOT_DIALOGUE_AUDIO_ROUTE_MAX_COUNT_EXCEEDED',
      })
    );
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
    subjectId: 'dialogue_urban',
  };
}
