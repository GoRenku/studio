import type { JsonValue } from '../../../media/contracts.js';
import { saveElevenLabsAudioStream } from '../audio-output.js';
import { requestElevenLabsAudio } from '../client.js';
import { requireString } from './input-fields.js';
import type { ElevenLabsOperation } from './registry.js';

export const elevenLabsMusicOperation: ElevenLabsOperation = {
  validate(input, target) {
    requireString(input.prompt, 'prompt', target.model);
  },
  async execute(input, target, context) {
    const stream = await requestElevenLabsAudio({
      model: target.model,
      context,
      send: (client) => client.music.compose({
        prompt: input.prompt as string,
        musicLengthMs: numberValue(input.music_length_ms),
        modelId: 'music_v1',
        forceInstrumental: booleanValue(input.force_instrumental),
      }, { abortSignal: context.signal }),
    });
    return saveElevenLabsAudioStream({ stream, nativeInput: input, model: target.model, context });
  },
};

function numberValue(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function booleanValue(value: JsonValue | undefined): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
