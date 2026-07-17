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
            projectRelativePath: 'cast/mehmed-ii/voice-samples/normal-voice.mp3',
            mediaKind: 'audio',
          }),
        ],
      },
    });
    expect(attached.resourceKeys).toEqual([
      `surface:castMember:${castMemberId}`,
    ]);

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
      projectData.discardAsset({
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
    expect(removed.resourceKeys).toEqual([
      `surface:castMember:${castMemberId}`,
    ]);
    expect(removed.recovery?.trashItemIds).toHaveLength(1);
    await expect(
      fs.access(path.join(projectPath, 'cast/mehmed-ii/voice-samples/normal-voice.mp3'))
    ).resolves.toBeUndefined();
    await expect(
      projectData.listCastVoices({
        projectName: 'constantinople',
        homeDir,
        castMemberId,
      })
    ).resolves.toEqual({ voices: [] });
    await expect(
      projectData.listTrash({ projectName: 'constantinople', homeDir })
    ).resolves.toMatchObject({
      items: [
        expect.objectContaining({
          itemKind: 'castVoice',
          itemId: attached.voice.id,
        }),
      ],
    });
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
        provider: 'elevenlabs',
        registrationModel: 'eleven_multilingual_v2',
        externalVoiceId: 'voice_urban_multilingual',
        capabilities: ['dialogue-audio-tts'],
      },
    });

    expect(created.registration).toMatchObject({
      castVoiceId: attached.voice.id,
      provider: 'elevenlabs',
      registrationModel: 'eleven_multilingual_v2',
      externalVoiceId: 'voice_urban_multilingual',
      capabilities: ['dialogue-audio-tts'],
      sourceSampleAssetId: attached.voice.sample.assetId,
    });
    expect(created.resourceKeys).toEqual([
      `surface:castMember:${castMemberId}`,
    ]);
    expect(created.voice.providerRegistrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'elevenlabs',
          capabilities: ['dialogue-audio-tts'],
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
      registration: { externalVoiceId: 'voice_urban_multilingual' },
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
          provider: 'elevenlabs',
          registrationModel: 'eleven_v3',
          externalVoiceId: 'voice_urban_normal',
          capabilities: ['kling-video-voice-control'],
        } as never,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA360' });
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

});
