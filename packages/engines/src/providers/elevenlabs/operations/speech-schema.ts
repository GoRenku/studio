import type { JsonValue } from '../../../media/contracts.js';
import { elevenLabsOutputFormatSchema } from './output-format-schema.js';

/**
 * Native Text to Speech request accepted by Renku.
 * Sources (checked 2026-10-11): the ElevenLabs Text to Speech API reference for fields and defaults,
 * the ElevenLabs prompting controls guide for the 0.7–1.2 speed range, and the pinned
 * `@elevenlabs/elevenlabs-js` 2.71 `VoiceSettings` type. Stability, similarity boost and style
 * are unit-interval settings.
 */
export const elevenLabsSpeechInputSchema: JsonValue = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'voice'],
  properties: {
    text: { type: 'string', minLength: 1, pattern: '\\S' },
    voice: { type: 'string', minLength: 1, pattern: '\\S', description: 'ElevenLabs voice id.' },
    voice_settings: {
      type: 'object',
      additionalProperties: false,
      properties: {
        stability: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
        similarity_boost: { type: 'number', minimum: 0, maximum: 1, default: 0.75 },
        style: { type: 'number', minimum: 0, maximum: 1, default: 0 },
        speed: { type: 'number', minimum: 0.7, maximum: 1.2, default: 1 },
        use_speaker_boost: { type: 'boolean', default: true },
      },
    },
    output_format: elevenLabsOutputFormatSchema,
  },
};
