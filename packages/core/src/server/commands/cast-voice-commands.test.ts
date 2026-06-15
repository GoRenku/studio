import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CastVoiceAttachmentDocument,
  CastVoiceElevenLabsSampleAttachmentDocument,
  ProjectRelativePath,
} from '../../client/index.js';
import {
  createProjectDataService,
  type ProjectDataService,
} from '../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('Cast Voice commands', () => {
  let homeDir: string;
  let projectData: ProjectDataService;
  let projectPath: string;
  let castMemberId: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cast-voice-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);

    projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    projectPath = created.projectPath;
    const project = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    castMemberId = project.cast.find((member) => member.handle === 'mehmed-ii')!.id;
  });

  it('validates, attaches, lists, reads, and removes a Cast Voice sample asset', async () => {
    await writeSample('generated/audio/normal.mp3', 'voice bytes');

    await expect(
      projectData.validateCastVoiceAttachment({
        projectName: 'constantinople',
        homeDir,
        document: attachmentDocument(),
      })
    ).resolves.toEqual({ valid: true, warnings: [] });

    const attached = await projectData.attachCastVoice({
      projectName: 'constantinople',
      homeDir,
      document: attachmentDocument(),
    });
    expect(attached.voice).toMatchObject({
      castMemberId,
      name: 'normal-voice',
      purpose: 'calm strategic baseline',
      providerRegistrations: [
        expect.objectContaining({
          provider: 'elevenlabs',
          registrationModel: 'eleven_v3',
          externalVoiceId: 'voice_urban_normal',
          capabilities: ['dialogue-audio-tts'],
          sourceSampleAssetId: attached.voice.sample.assetId,
        }),
      ],
      sampleSource: { kind: 'custom_file' },
      sample: {
        role: 'voice_sample',
        referenceName: 'normal-voice',
        purpose: 'calm strategic baseline',
        files: [
          expect.objectContaining({
            projectRelativePath: 'cast/mehmed-ii/voice-samples/normal.mp3',
            mediaKind: 'audio',
          }),
        ],
      },
    });

    await expect(
      projectData.listCastVoices({
        projectName: 'constantinople',
        homeDir,
        castMemberId,
      })
    ).resolves.toMatchObject({
      voices: [expect.objectContaining({ id: attached.voice.id })],
    });
    await expect(
      projectData.readCastVoice({
        projectName: 'constantinople',
        homeDir,
        castMemberId,
        voiceIdOrName: 'normal-voice',
      })
    ).resolves.toMatchObject({
      voice: { id: attached.voice.id },
    });

    await expect(
      projectData.deleteAsset({
        projectName: 'constantinople',
        homeDir,
        target: { kind: 'castMember', castMemberId },
        assetId: attached.voice.sample.assetId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA353' });

    const removed = await projectData.removeCastVoice({
      projectName: 'constantinople',
      homeDir,
      castMemberId,
      voiceIdOrName: attached.voice.id,
    });
    expect(removed.removed).toMatchObject({
      voiceId: attached.voice.id,
      sampleAssetId: attached.voice.sample.assetId,
    });
    await expect(
      fs.access(path.join(projectPath, 'cast/mehmed-ii/voice-samples/normal.mp3'))
    ).rejects.toThrow();
    await expect(
      projectData.listCastVoices({
        projectName: 'constantinople',
        homeDir,
        castMemberId,
      })
    ).resolves.toEqual({ voices: [] });
  });

  it('rejects duplicate Cast Voice reference names', async () => {
    await writeSample('generated/audio/normal.mp3', 'first voice bytes');
    await projectData.attachCastVoice({
      projectName: 'constantinople',
      homeDir,
      document: attachmentDocument(),
    });

    await writeSample('generated/audio/normal-2.mp3', 'second voice bytes');
    await expect(
      projectData.attachCastVoice({
        projectName: 'constantinople',
        homeDir,
        document: attachmentDocument({
          sample: {
            sourceProjectRelativePath: 'generated/audio/normal-2.mp3' as ProjectRelativePath,
            title: 'Mehmed alternate voice sample',
          },
        }),
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA341' });
  });

  it('creates, reads, lists, and removes provider registrations on one Cast Voice', async () => {
    await writeSample('generated/audio/normal.mp3', 'voice bytes');
    const attached = await projectData.attachCastVoice({
      projectName: 'constantinople',
      homeDir,
      document: attachmentDocument(),
    });

    const created = await projectData.createCastVoiceProviderRegistration({
      projectName: 'constantinople',
      homeDir,
      castMemberId,
      voiceIdOrName: attached.voice.id,
      registration: {
        provider: 'fal-ai',
        registrationModel: 'kling-video/create-voice',
        externalVoiceId: 'kling_voice_urban',
        capabilities: ['kling-video-voice-control'],
      },
    });

    expect(created.registration).toMatchObject({
      castVoiceId: attached.voice.id,
      provider: 'fal-ai',
      registrationModel: 'kling-video/create-voice',
      externalVoiceId: 'kling_voice_urban',
      capabilities: ['kling-video-voice-control'],
      sourceSampleAssetId: attached.voice.sample.assetId,
    });
    expect(created.voice.providerRegistrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'elevenlabs',
          capabilities: ['dialogue-audio-tts'],
        }),
        expect.objectContaining({
          provider: 'fal-ai',
          capabilities: ['kling-video-voice-control'],
        }),
      ])
    );

    await expect(
      projectData.listCastVoiceProviderRegistrations({
        projectName: 'constantinople',
        homeDir,
        castMemberId,
        voiceIdOrName: attached.voice.id,
      })
    ).resolves.toMatchObject({
      registrations: expect.arrayContaining([
        expect.objectContaining({ id: created.registration.id }),
      ]),
    });

    await expect(
      projectData.readCastVoiceProviderRegistration({
        projectName: 'constantinople',
        homeDir,
        castMemberId,
        voiceIdOrName: attached.voice.id,
        registrationId: created.registration.id,
      })
    ).resolves.toMatchObject({
      registration: { externalVoiceId: 'kling_voice_urban' },
    });

    await expect(
      projectData.removeCastVoiceProviderRegistration({
        projectName: 'constantinople',
        homeDir,
        castMemberId,
        voiceIdOrName: attached.voice.id,
        registrationId: created.registration.id,
      })
    ).resolves.toMatchObject({
      removed: {
        castVoiceId: attached.voice.id,
        registrationId: created.registration.id,
      },
    });
    await expect(
      projectData.listCastVoiceProviderRegistrations({
        projectName: 'constantinople',
        homeDir,
        castMemberId,
        voiceIdOrName: attached.voice.id,
      })
    ).resolves.toMatchObject({
      registrations: [
        expect.objectContaining({
          provider: 'elevenlabs',
          capabilities: ['dialogue-audio-tts'],
        }),
      ],
    });
  });

  it('rejects provider registrations with mismatched capabilities', async () => {
    await writeSample('generated/audio/normal.mp3', 'voice bytes');
    const attached = await projectData.attachCastVoice({
      projectName: 'constantinople',
      homeDir,
      document: attachmentDocument(),
    });

    await expect(
      projectData.createCastVoiceProviderRegistration({
        projectName: 'constantinople',
        homeDir,
        castMemberId,
        voiceIdOrName: attached.voice.id,
        registration: {
          provider: 'fal-ai',
          registrationModel: 'kling-video/create-voice',
          externalVoiceId: 'kling_voice_urban',
          capabilities: ['dialogue-audio-tts'],
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA360' });
  });

  it('estimates and runs a simulated Kling Cast Voice registration', async () => {
    await writeWavSample('generated/audio/normal.wav', 6);
    const attached = await projectData.attachCastVoice({
      projectName: 'constantinople',
      homeDir,
      document: attachmentDocument({
        sample: {
          sourceProjectRelativePath: 'generated/audio/normal.wav' as ProjectRelativePath,
          title: 'Mehmed normal voice sample',
        },
      }),
    });
    const spec = {
      purpose: 'klingVoiceRegistration' as const,
      castVoiceName: attached.voice.name,
      castMemberId,
      sourceCastVoiceId: attached.voice.id,
      sourceProjectRelativePath:
        'cast/mehmed-ii/voice-samples/normal.wav' as ProjectRelativePath,
    };

    const estimate = await projectData.estimateKlingCastVoiceRegistration({
      projectName: 'constantinople',
      homeDir,
      spec,
    });
    expect(estimate.estimate).toMatchObject({
      provider: 'fal-ai',
      model: 'kling-video/create-voice',
      mediaKind: 'json',
      estimatedCostUsd: 0.007,
    });

    const registered = await projectData.runKlingCastVoiceRegistration({
      projectName: 'constantinople',
      homeDir,
      spec,
      simulate: true,
    });

    expect(registered.providerVoiceId).toBeTruthy();
    expect(registered.registration).toMatchObject({
      provider: 'fal-ai',
      registrationModel: 'kling-video/create-voice',
      capabilities: ['kling-video-voice-control'],
      sourceSampleAssetId: attached.voice.sample.assetId,
    });
    expect(registered.voice.providerRegistrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'fal-ai',
          externalVoiceId: registered.providerVoiceId,
          capabilities: ['kling-video-voice-control'],
        }),
      ])
    );
  });

  it('rejects Kling Cast Voice registrations outside the provider duration window', async () => {
    await writeWavSample('generated/audio/normal.wav', 31);
    const attached = await projectData.attachCastVoice({
      projectName: 'constantinople',
      homeDir,
      document: attachmentDocument({
        sample: {
          sourceProjectRelativePath: 'generated/audio/normal.wav' as ProjectRelativePath,
          title: 'Mehmed long voice sample',
        },
      }),
    });

    await expect(
      projectData.estimateKlingCastVoiceRegistration({
        projectName: 'constantinople',
        homeDir,
        spec: {
          purpose: 'klingVoiceRegistration',
          castVoiceName: attached.voice.name,
          castMemberId,
          sourceCastVoiceId: attached.voice.id,
          sourceProjectRelativePath:
            'cast/mehmed-ii/voice-samples/normal.wav' as ProjectRelativePath,
        },
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA368' });
  });

  it('rejects unsupported providers, wrapper models, and receipt mismatches', async () => {
    await writeSample('generated/audio/normal.mp3', 'voice bytes');

    await expect(
      projectData.validateCastVoiceAttachment({
        projectName: 'constantinople',
        homeDir,
        document: attachmentDocument({ provider: 'fal-ai' }),
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA342' });

    await expect(
      projectData.validateCastVoiceAttachment({
        projectName: 'constantinople',
        homeDir,
        document: attachmentDocument({ model: 'wavespeed/elevenlabs-tts' }),
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA343' });

    await expect(
      projectData.validateCastVoiceAttachment({
        projectName: 'constantinople',
        homeDir,
        document: attachmentDocument({
          sample: {
            sourceProjectRelativePath: 'generated/audio/normal.mp3' as ProjectRelativePath,
            title: 'Mehmed normal voice sample',
            receipt: {
              run: {
                provider: 'elevenlabs',
                model: 'eleven_multilingual_v2',
              },
            },
          },
        }),
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA354' });

    await expect(
      projectData.validateCastVoiceAttachment({
        projectName: 'constantinople',
        homeDir,
        document: attachmentDocument({
          voiceId: 'voice_urban_alternate',
          sample: {
            sourceProjectRelativePath: 'generated/audio/normal.mp3' as ProjectRelativePath,
            title: 'Mehmed normal voice sample',
            receipt: {
              run: {
                provider: 'elevenlabs',
                model: 'eleven_v3',
                providerPayload: {
                  voice: 'voice_urban_normal',
                },
              },
            },
          },
        }),
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA354' });
  });

  it('attaches an existing ElevenLabs provider voice sample without generation records', async () => {
    const document = elevenLabsSampleAttachmentDocument();
    await expect(
      projectData.validateCastVoiceAttachment({
        projectName: 'constantinople',
        homeDir,
        document,
      })
    ).resolves.toEqual({ valid: true, warnings: [] });

    const fetchedAt = '2026-06-09T10:00:00.000Z';
    const attached = await projectData.attachCastVoice({
      projectName: 'constantinople',
      homeDir,
      document,
      elevenLabsVoiceSampleFetcher: async ({ voiceId }) => ({
        provider: 'elevenlabs',
        voiceId,
        sampleId: 'sample_01jz9br9f2m36md5s6v3q3r6n4',
        voiceName: 'Urban',
        sampleFileName: 'preview.mp3',
        mimeType: 'audio/mpeg',
        audioBytes: Buffer.from('mp3 bytes'),
        fetchedAt,
        apiBaseUrl: 'https://api.elevenlabs.io',
        contentLength: 9,
      }),
    });

    expect(attached.voice).toMatchObject({
      name: 'provider-voice',
      sampleSource: {
        kind: 'elevenlabs_voice_sample',
        sampleId: 'sample_01jz9br9f2m36md5s6v3q3r6n4',
        fetchedAt,
        apiBaseUrl: 'https://api.elevenlabs.io',
      },
      sample: {
        origin: 'elevenlabs_sample',
        files: [
          expect.objectContaining({
            projectRelativePath: 'cast/mehmed-ii/voice-samples/provider-voice.mp3',
            mimeType: 'audio/mpeg',
            sizeBytes: 9,
          }),
        ],
      },
    });
    expect(attached.sampleRetrieval).toEqual({
      provider: 'elevenlabs',
      voiceId: 'voice_urban_normal',
      sampleId: 'sample_01jz9br9f2m36md5s6v3q3r6n4',
      mimeType: 'audio/mpeg',
      sizeBytes: 9,
      fetchedAt,
      apiBaseUrl: 'https://api.elevenlabs.io',
    });
    await expect(
      fs.readFile(
        path.join(projectPath, 'cast/mehmed-ii/voice-samples/provider-voice.mp3'),
        'utf8'
      )
    ).resolves.toBe('mp3 bytes');
  });

  it('rejects file fields in ElevenLabs provider sample attachment documents', async () => {
    await expect(
      projectData.validateCastVoiceAttachment({
        projectName: 'constantinople',
        homeDir,
        document: {
          ...elevenLabsSampleAttachmentDocument(),
          sample: {
            title: 'Mehmed provider voice sample',
            sourceProjectRelativePath: 'generated/audio/normal.mp3',
          },
        } as never,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA355' });

    await expect(
      projectData.validateCastVoiceAttachment({
        projectName: 'constantinople',
        homeDir,
        document: {
          ...elevenLabsSampleAttachmentDocument(),
          sample: {
            title: 'Mehmed provider voice sample',
            receipt: { run: { provider: 'elevenlabs' } },
          },
        } as never,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA356' });
  });

  it('persists generated sample source when a matching generation receipt is attached', async () => {
    await writeSample('generated/audio/receipt.mp3', 'generated voice bytes');

    const attached = await projectData.attachCastVoice({
      projectName: 'constantinople',
      homeDir,
      document: attachmentDocument({
        name: 'generated-voice',
        sample: {
          sourceProjectRelativePath: 'generated/audio/receipt.mp3' as ProjectRelativePath,
          title: 'Mehmed generated voice sample',
          receipt: {
            run: {
              provider: 'elevenlabs',
              model: 'eleven_v3',
              providerPayload: {
                voice: 'voice_urban_normal',
              },
            },
          },
        },
      }),
    });

    expect(attached.voice).toMatchObject({
      sampleSource: { kind: 'generated_sample' },
      sample: { origin: 'generated' },
    });
  });

  function attachmentDocument(
    overrides: Partial<CastVoiceAttachmentDocument> = {}
  ): CastVoiceAttachmentDocument {
    return {
      kind: 'castVoiceAttachment',
      castMemberId,
      name: 'normal-voice',
      provider: 'elevenlabs',
      model: 'eleven_v3',
      voiceId: 'voice_urban_normal',
      purpose: 'calm strategic baseline',
      sample: {
        sourceProjectRelativePath: 'generated/audio/normal.mp3' as ProjectRelativePath,
        title: 'Mehmed normal voice sample',
      },
      ...overrides,
    };
  }

  function elevenLabsSampleAttachmentDocument(
    overrides: Partial<CastVoiceElevenLabsSampleAttachmentDocument> = {}
  ): CastVoiceElevenLabsSampleAttachmentDocument {
    return {
      kind: 'castVoiceElevenLabsSampleAttachment',
      castMemberId,
      name: 'provider-voice',
      provider: 'elevenlabs',
      model: 'eleven_v3',
      voiceId: 'voice_urban_normal',
      purpose: 'calm strategic baseline',
      sample: {
        title: 'Mehmed provider voice sample',
      },
      ...overrides,
    };
  }

  async function writeSample(projectRelativePath: string, contents: string) {
    const absolutePath = path.join(projectPath, projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, contents);
  }

  async function writeWavSample(projectRelativePath: string, durationSeconds: number) {
    const absolutePath = path.join(projectPath, projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, silentWav(durationSeconds));
  }

  function silentWav(durationSeconds: number): Buffer {
    const sampleRate = 8000;
    const channels = 1;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const dataSize = sampleRate * durationSeconds * channels * bytesPerSample;
    const buffer = Buffer.alloc(44 + dataSize);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
    buffer.writeUInt16LE(channels * bytesPerSample, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    return buffer;
  }
});
