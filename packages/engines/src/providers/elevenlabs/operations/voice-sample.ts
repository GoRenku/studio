import { writeAudio } from '../audio-output.js';
import { fetchElevenLabsVoiceSampleAudio } from '../voice-samples.js';
import { requireString } from './input-fields.js';
import type { ElevenLabsOperation } from './registry.js';

export const elevenLabsVoiceSampleOperation: ElevenLabsOperation = {
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['voiceId'],
    properties: {
      voiceId: { type: 'string', minLength: 1 },
      apiBaseUrl: { type: 'string', minLength: 1 },
    },
  },
  validate(input, target) {
    requireString(input.voiceId, 'voiceId', target.model);
    if (input.apiBaseUrl !== undefined) {
      requireString(input.apiBaseUrl, 'apiBaseUrl', target.model);
    }
  },
  async execute(input, target, context) {
    const sample = await fetchElevenLabsVoiceSampleAudio({
      voiceId: input.voiceId as string,
      credential: context.credential,
      ...(typeof input.apiBaseUrl === 'string' ? { apiBaseUrl: input.apiBaseUrl } : {}),
      ...(context.logger ? { logger: context.logger } : {}),
      signal: context.signal,
      fetch: context.fetch,
    });
    const artifact = await writeAudio(
      sample.audioBytes,
      sample.mimeType,
      'mp3',
      target.model,
      context,
    );
    return {
      provider: 'elevenlabs',
      model: target.model,
      artifacts: [artifact],
      receipt: {
        voiceId: sample.voiceId,
        sampleId: sample.sampleId,
        voiceName: sample.voiceName,
        sampleFileName: sample.sampleFileName,
        fetchedAt: sample.fetchedAt,
        apiBaseUrl: sample.apiBaseUrl,
        contentLength: sample.contentLength,
      },
    };
  },
};
