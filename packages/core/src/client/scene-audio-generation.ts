import type { SceneDialogueMediaGenerationTarget } from './media-generation-target.js';
import { SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE } from './media-generation-purpose.js';

export type SceneDialogueAudioModelChoice =
  | 'elevenlabs/eleven_v3'
  | 'elevenlabs/eleven_multilingual_v2'
  | 'elevenlabs/eleven_turbo_v2_5';

export type SceneDialogueAudioTextTreatment =
  | 'elevenlabs-v3-audio-tags'
  | 'plain-tts';

export interface SceneDialogueAudioVoiceSettings {
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
  useSpeakerBoost?: boolean;
}

export interface SceneDialogueAudioGenerationSpec {
  purpose: typeof SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE;
  target: SceneDialogueMediaGenerationTarget;
  modelChoice: SceneDialogueAudioModelChoice;
  castVoiceId: string;
  plainText: string;
  v3Text: string;
  voiceSettings?: SceneDialogueAudioVoiceSettings;
  outputFormat?: string;
  languageCode?: string | null;
  title?: string;
}

export interface SceneDialogueAudio {
  id: string;
  sceneId: string;
  dialogueId: string;
  castMemberId: string;
  castVoiceId: string | null;
  modelChoice: SceneDialogueAudioModelChoice;
  plainText: string;
  v3Text: string;
  voiceSettings: SceneDialogueAudioVoiceSettings;
  outputFormat: string;
  languageCode: string | null;
  takes: SceneDialogueAudioTake[];
  createdAt: string;
  updatedAt: string;
}

export interface SceneDialogueAudioTake {
  takeId: string;
  sceneDialogueAudioId: string;
  assetId: string;
  assetFileId: string;
  mediaGenerationRunId: string;
  modelChoice: SceneDialogueAudioModelChoice;
  castVoiceId: string;
  castVoiceName: string;
  provider: 'elevenlabs';
  providerVoiceId: string;
  providerTextSnapshot: string;
  plainTextSnapshot: string;
  v3TextSnapshot: string;
  textTreatment: SceneDialogueAudioTextTreatment;
  voiceSettingsSnapshot: SceneDialogueAudioVoiceSettings;
  outputFormat: string;
  languageCode: string | null;
  createdAt: string;
}

export interface SceneDialogueAudioDialogueContext {
  dialogueId: string;
  castMemberId: string | null;
  speakerName: string;
  plainText: string;
}

export interface SceneDialogueAudioCastVoiceOption {
  id: string;
  castMemberId: string;
  name: string;
  provider: 'elevenlabs';
  model: string;
  voiceId: string;
  purpose: string;
  usable: boolean;
}

export interface SceneDialogueAudioContext {
  purpose: typeof SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE;
  target: { kind: 'scene'; sceneId: string };
  project: {
    name: string;
    title: string;
    baseLanguageCode: string | null;
  };
  scene: {
    id: string;
    title: string;
    settingLabel: string | null;
  };
  dialogues: SceneDialogueAudioDialogueContext[];
  castMemberLabels: Record<string, string>;
  castVoicesByCastMemberId: Record<string, SceneDialogueAudioCastVoiceOption[]>;
  audioByDialogueId: Record<string, SceneDialogueAudio>;
  models: SceneDialogueAudioModelChoiceReport[];
  defaults: {
    modelChoice: SceneDialogueAudioModelChoice;
    outputFormat: string;
    languageCode: string | null;
    voiceSettings: SceneDialogueAudioVoiceSettings;
  };
  resourceKeys: string[];
}

export interface SceneDialogueAudioMutationReport {
  context: SceneDialogueAudioContext;
  recovery?: import('./trash.js').RecoverableMutationReport['recovery'];
  resourceKeys: string[];
}

export interface SceneDialogueAudioModelChoiceReport {
  modelChoice: SceneDialogueAudioModelChoice;
  label: string;
  available: true;
  provider: 'elevenlabs';
  model: 'eleven_v3' | 'eleven_multilingual_v2' | 'eleven_turbo_v2_5';
  mediaKind: 'audio';
  mode: 'text-to-speech';
  supportsAudioTags: boolean;
  textTreatment: SceneDialogueAudioTextTreatment;
  defaultVoiceSettings: SceneDialogueAudioVoiceSettings;
  outputFormats: string[];
}

export interface SceneDialogueAudioModelListReport {
  purpose: typeof SCENE_DIALOGUE_AUDIO_GENERATION_PURPOSE;
  target: SceneDialogueMediaGenerationTarget;
  models: SceneDialogueAudioModelChoiceReport[];
}
