import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CastVoiceAttachmentDocument, ProjectRelativePath } from '../../client/index.js';
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
      provider: 'elevenlabs',
      model: 'eleven_v3',
      voiceId: 'voice_urban_normal',
      purpose: 'calm strategic baseline',
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

  async function writeSample(projectRelativePath: string, contents: string) {
    const absolutePath = path.join(projectPath, projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, contents);
  }
});
