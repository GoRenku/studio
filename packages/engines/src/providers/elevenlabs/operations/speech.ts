import type { JsonValue } from '../../../media/contracts.js';
import { outputFormat, saveElevenLabsAudioStream } from '../audio-output.js';
import { requestElevenLabsAudio } from '../client.js';
import { requireString } from './input-fields.js';
import type { ElevenLabsOperation } from './registry.js';

interface VoiceSettings {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  speed?: number;
  use_speaker_boost?: boolean;
}

export const elevenLabsSpeechOperation: ElevenLabsOperation = {
  validate(input, target) {
    requireString(input.text, 'text', target.model);
    requireString(input.voice, 'voice', target.model);
  },
  async execute(input, target, context) {
    const stream = await requestElevenLabsAudio({
      model: target.model,
      context,
      send: (client) => client.textToSpeech.convert(input.voice as string, {
        text: input.text as string,
        modelId: target.modelId,
        outputFormat: outputFormat(input),
        voiceSettings: voiceSettings(input.voice_settings),
      }, { abortSignal: context.signal }),
    });
    return saveElevenLabsAudioStream({ stream, nativeInput: input, model: target.model, context });
  },
};

function voiceSettings(value: JsonValue | undefined) {
  if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const settings = value as VoiceSettings;
  return {
    stability: settings.stability,
    similarityBoost: settings.similarity_boost,
    style: settings.style,
    speed: settings.speed,
    useSpeakerBoost: settings.use_speaker_boost,
  };
}
