import { describe, expect, it, vi } from 'vitest';
import { readRequiredJsonInput } from './command-io.js';
import { castVoiceCommandHandlers } from './cast-voice-command-handlers.js';

vi.mock('./command-io.js', async (importOriginal) => ({
  ...await importOriginal<typeof import('./command-io.js')>(),
  readRequiredJsonInput: vi.fn(),
}));

describe('Cast Voice CLI attachment boundary', () => {
  it('passes opaque voice identity to Core without interpreting provider fields', async () => {
    const document = {
      kind: 'castVoiceFileAttachment',
      castMemberId: 'cast_1',
      name: 'normal',
      purpose: 'Dialogue',
      voiceIdentity: {
        provider: 'elevenlabs',
        voiceId: 'voice_1',
        providerOwnedField: { exact: true },
      },
      sample: {
        title: 'Normal sample',
        sourceProjectRelativePath: 'tmp/media/sample.mp3',
      },
    } as const;
    vi.mocked(readRequiredJsonInput).mockResolvedValue(document);
    const attachCastVoice = vi.fn().mockResolvedValue({ valid: true });

    await attachHandler().run({
      flags: { file: 'tmp/operations/cast-voice.json' },
      runtime: runtime({ attachCastVoice }),
    });

    expect(attachCastVoice).toHaveBeenCalledWith({
      homeDir: '/tmp/home',
      projectName: undefined,
      document,
    });
  });

  it('passes a file-backed voice without inventing provider identity', async () => {
    const document = {
      kind: 'castVoiceFileAttachment',
      castMemberId: 'cast_1',
      name: 'reference',
      purpose: 'Dialogue',
      sample: {
        title: 'Reference sample',
        sourceProjectRelativePath: 'tmp/media/reference.wav',
      },
    } as const;
    vi.mocked(readRequiredJsonInput).mockResolvedValue(document);
    const attachCastVoice = vi.fn().mockResolvedValue({ valid: true });

    await attachHandler().run({
      flags: { file: 'tmp/operations/cast-voice.json' },
      runtime: runtime({ attachCastVoice }),
    });

    expect(attachCastVoice).toHaveBeenCalledWith(expect.objectContaining({ document }));
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
