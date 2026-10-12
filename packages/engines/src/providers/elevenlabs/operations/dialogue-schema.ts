import type { JsonValue } from '../../../media/contracts.js';
import { elevenLabsOutputFormatSchema } from './output-format-schema.js';

/**
 * Native Text to Dialogue request accepted by Renku.
 * Sources (checked 2026-10-11): the ElevenLabs Text to Dialogue API reference for fields, defaults
 * and the seed range, and the pinned `@elevenlabs/elevenlabs-js` 2.71 `ToDialogueSettingsResponseModel`
 * type. Stability and similarity are unit-interval settings. The distinct-voice limit is checked
 * by the operation because JSON Schema cannot express it.
 */
export const elevenLabsDialogueInputSchema: JsonValue = {
  type: 'object',
  additionalProperties: false,
  required: ['inputs'],
  properties: {
    inputs: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'voice'],
        properties: {
          text: { type: 'string', minLength: 1, pattern: '\\S' },
          voice: { type: 'string', minLength: 1, pattern: '\\S', description: 'ElevenLabs voice id.' },
        },
      },
    },
    settings: {
      type: 'object',
      additionalProperties: false,
      properties: {
        stability: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
        similarity: { type: 'number', minimum: 0, maximum: 1, default: 0.75 },
      },
    },
    output_format: elevenLabsOutputFormatSchema,
    language_code: { type: 'string', minLength: 1, pattern: '\\S', description: 'ISO 639-1 language code.' },
    seed: { type: 'integer', minimum: 0, maximum: 4294967295 },
  },
};
