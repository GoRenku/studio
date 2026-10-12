import type { JsonValue } from '../../../media/contracts.js';

/** ElevenLabs `output_format` values, from the Text to Speech and Text to Dialogue API references (checked 2026-10-11). */
export const elevenLabsOutputFormatSchema: JsonValue = {
  type: 'string',
  enum: [
    'alaw_8000',
    'mp3_22050_32', 'mp3_24000_48', 'mp3_44100_32', 'mp3_44100_64', 'mp3_44100_96', 'mp3_44100_128', 'mp3_44100_192',
    'opus_48000_32', 'opus_48000_64', 'opus_48000_96', 'opus_48000_128', 'opus_48000_192',
    'pcm_8000', 'pcm_16000', 'pcm_22050', 'pcm_24000', 'pcm_32000', 'pcm_44100', 'pcm_48000',
    'ulaw_8000',
    'wav_8000', 'wav_16000', 'wav_22050', 'wav_24000', 'wav_32000', 'wav_44100', 'wav_48000',
  ],
  default: 'mp3_44100_128',
};
