import { Buffer } from 'node:buffer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveRenkuProviderCredential } from '@gorenku/studio-core/server';
import { fetchElevenLabsVoiceSampleAudio } from '@gorenku/studio-engines';
import { readRequiredJsonInput } from './command-io.js';
import { castVoiceCommandHandlers } from './cast-voice-command-handlers.js';

vi.mock('@gorenku/studio-core/server', async (importOriginal) => ({
  ...await importOriginal<typeof import('@gorenku/studio-core/server')>(),
  resolveRenkuProviderCredential: vi.fn(),
}));

vi.mock('@gorenku/studio-engines', async (importOriginal) => ({
  ...await importOriginal<typeof import('@gorenku/studio-engines')>(),
  fetchElevenLabsVoiceSampleAudio: vi.fn(),
}));

vi.mock('./command-io.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./command-io.js')>(),
  readRequiredJsonInput: vi.fn(),
}));

describe('Cast Voice CLI provider composition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('injects focused Engines sample retrieval only for an ElevenLabs provider sample', async () => {
    vi.mocked(readRequiredJsonInput).mockResolvedValue({
      kind: 'castVoiceElevenLabsSampleAttachment',
      castMemberId: 'cast_1',
      name: 'normal',
      provider: 'elevenlabs',
      model: 'eleven_v3',
      voiceId: 'voice_1',
      purpose: 'Dialogue',
      sample: { title: 'Normal sample' },
    });
    vi.mocked(resolveRenkuProviderCredential).mockResolvedValue('secret');
    vi.mocked(fetchElevenLabsVoiceSampleAudio).mockResolvedValue({
      provider: 'elevenlabs',
      voiceId: 'voice_1',
      sampleId: 'sample_1',
      voiceName: 'Voice',
      sampleFileName: 'sample.mp3',
      mimeType: 'audio/mpeg',
      audioBytes: Buffer.from('audio'),
      fetchedAt: '2026-08-24T00:00:00.000Z',
      apiBaseUrl: 'https://api.elevenlabs.io',
      contentLength: 5,
    });
    const attachCastVoice = vi.fn(async (input) => {
      const sample = await input.elevenLabsVoiceSampleFetcher?.({ voiceId: 'voice_1' });
      return { sample };
    });

    const result = await attachHandler().run({
      flags: { file: 'tmp/operations/cast-voice.json' },
      runtime: runtime({ attachCastVoice }),
    });

    expect(resolveRenkuProviderCredential).toHaveBeenCalledWith('elevenlabs', {
      homeDir: '/tmp/home',
    });
    expect(fetchElevenLabsVoiceSampleAudio).toHaveBeenCalledWith({
      voiceId: 'voice_1',
      credential: 'secret',
    });
    expect(result).toEqual(expect.objectContaining({
      sample: expect.objectContaining({ sampleId: 'sample_1' }),
    }));
  });

  it('keeps file sample attachment inside Core without resolving a provider credential', async () => {
    vi.mocked(readRequiredJsonInput).mockResolvedValue({
      kind: 'castVoiceAttachment',
      castMemberId: 'cast_1',
      name: 'normal',
      provider: 'elevenlabs',
      model: 'eleven_v3',
      voiceId: 'voice_1',
      purpose: 'Dialogue',
      sample: {
        title: 'Normal sample',
        sourceProjectRelativePath: 'tmp/media/sample.mp3',
      },
    });
    const attachCastVoice = vi.fn().mockResolvedValue({ valid: true });

    await attachHandler().run({
      flags: { file: 'tmp/operations/cast-voice.json' },
      runtime: runtime({ attachCastVoice }),
    });

    expect(resolveRenkuProviderCredential).not.toHaveBeenCalled();
    expect(attachCastVoice).toHaveBeenCalledWith(expect.not.objectContaining({
      elevenLabsVoiceSampleFetcher: expect.anything(),
    }));
  });
});

function attachHandler() {
  return castVoiceCommandHandlers.find((handler) => handler.path.join(' ') === 'attach')!;
}

function runtime(projectDataService: object) {
  return {
    homeDir: '/tmp/home',
    json: true,
    io: { stdout: { log: vi.fn() }, stderr: { log: vi.fn() } },
    projectDataService,
  } as never;
}
