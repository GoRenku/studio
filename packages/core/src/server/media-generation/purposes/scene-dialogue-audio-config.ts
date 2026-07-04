import type {
  SceneDialogueAudioModelChoice,
  SceneDialogueAudioModelListReport,
  SceneDialogueAudioTextTreatment,
  SceneDialogueAudioVoiceSettings,
} from '../../../client/index.js';

export const SCENE_DIALOGUE_AUDIO_MODEL_CHOICES =
  new Set<SceneDialogueAudioModelChoice>([
    'elevenlabs/eleven_v3',
    'elevenlabs/eleven_multilingual_v2',
    'elevenlabs/eleven_turbo_v2_5',
  ]);

export const DEFAULT_SCENE_DIALOGUE_AUDIO_MODEL_CHOICE: SceneDialogueAudioModelChoice =
  'elevenlabs/eleven_v3';

export const DEFAULT_SCENE_DIALOGUE_AUDIO_OUTPUT_FORMAT = 'mp3_44100_128';

export const MISSING_SCENE_DIALOGUE_AUDIO_CAST_VOICE_REASON =
  'Assign a Cast Voice before generating dialogue audio.';

export const DEFAULT_SCENE_DIALOGUE_AUDIO_VOICE_SETTINGS: SceneDialogueAudioVoiceSettings =
  {
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    speed: 1,
    useSpeakerBoost: true,
  };

export function sceneDialogueAudioModelReports(): SceneDialogueAudioModelListReport['models'] {
  return [
    sceneDialogueAudioModelReport('elevenlabs/eleven_v3', 'Eleven v3', true),
    sceneDialogueAudioModelReport(
      'elevenlabs/eleven_multilingual_v2',
      'Eleven Multilingual v2',
      false
    ),
    sceneDialogueAudioModelReport(
      'elevenlabs/eleven_turbo_v2_5',
      'Eleven Turbo v2.5',
      false
    ),
  ];
}

export function sceneDialogueAudioProviderModel(
  modelChoice: SceneDialogueAudioModelChoice
): 'eleven_v3' | 'eleven_multilingual_v2' | 'eleven_turbo_v2_5' {
  if (modelChoice === 'elevenlabs/eleven_v3') {
    return 'eleven_v3';
  }
  if (modelChoice === 'elevenlabs/eleven_multilingual_v2') {
    return 'eleven_multilingual_v2';
  }
  return 'eleven_turbo_v2_5';
}

export function sceneDialogueAudioTextTreatmentForModel(
  modelChoice: SceneDialogueAudioModelChoice
): SceneDialogueAudioTextTreatment {
  return modelChoice === 'elevenlabs/eleven_v3'
    ? 'elevenlabs-v3-audio-tags'
    : 'plain-tts';
}

function sceneDialogueAudioModelReport(
  modelChoice: SceneDialogueAudioModelChoice,
  label: string,
  supportsAudioTags: boolean
) {
  return {
    modelChoice,
    label,
    available: true as const,
    provider: 'elevenlabs' as const,
    model: sceneDialogueAudioProviderModel(modelChoice),
    mediaKind: 'audio' as const,
    mode: 'text-to-speech' as const,
    supportsAudioTags,
    textTreatment: sceneDialogueAudioTextTreatmentForModel(modelChoice),
    defaultVoiceSettings: DEFAULT_SCENE_DIALOGUE_AUDIO_VOICE_SETTINGS,
    outputFormats: [DEFAULT_SCENE_DIALOGUE_AUDIO_OUTPUT_FORMAT],
  };
}
