import { describe, expect, it } from 'vitest';
import { resolveElevenLabsOperation } from './registry.js';

describe('resolveElevenLabsOperation', () => {
  it.each([
    ['voice-sample-audio', 'voice-sample', 'voice-sample-audio'],
    ['music_v1', 'music', 'music_v1'],
    ['eleven_v4/text-to-dialogue', 'dialogue', 'eleven_v4'],
    ['eleven_v3/text-to-dialogue', 'dialogue', 'eleven_v3'],
    ['eleven_v4', 'speech', 'eleven_v4'],
    ['future_tts_model', 'speech', 'future_tts_model'],
  ])('resolves %s to the %s operation', (model, kind, modelId) => {
    expect(resolveElevenLabsOperation(model)).toMatchObject({
      kind,
      target: { model, modelId },
    });
  });

  it('rejects a dialogue route without a model id', () => {
    expect(() => resolveElevenLabsOperation('/text-to-dialogue')).toThrow(
      expect.objectContaining({ code: 'ENGINE_REQUEST_INVALID' }),
    );
  });

  it('does not resolve inherited object keys as fixed routes', () => {
    expect(resolveElevenLabsOperation('constructor')).toMatchObject({ kind: 'speech' });
  });
});
