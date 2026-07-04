import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CastVoiceSampleGenerationSpec } from '../../../client/index.js';
import { createProjectDataService, type ProjectDataService } from '../../index.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../../testing/project-data-fixtures.js';

describe('Cast Voice sample generation', () => {
  let homeDir: string;
  let projectData: ProjectDataService;
  let castMemberId: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cast-voice-sample-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);

    projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const project = await projectData.readProject({
      projectName: 'constantinople',
      homeDir,
    });
    castMemberId = project.cast.find((member) => member.handle === 'mehmed-ii')!.id;
  });

  it('lists only direct ElevenLabs TTS models', async () => {
    const models = await projectData.listMediaGenerationModels({
      projectName: 'constantinople',
      homeDir,
      purpose: 'cast.voice-sample',
      target: { kind: 'castMember', id: castMemberId },
    });

    expect(models).toMatchObject({
      purpose: 'cast.voice-sample',
      models: [
        { modelChoice: 'elevenlabs/eleven_v3', provider: 'elevenlabs' },
        {
          modelChoice: 'elevenlabs/eleven_multilingual_v2',
          provider: 'elevenlabs',
        },
        {
          modelChoice: 'elevenlabs/eleven_turbo_v2_5',
          provider: 'elevenlabs',
        },
      ],
    });
    expect(JSON.stringify(models)).not.toContain('fal-ai');
    expect(JSON.stringify(models)).not.toContain('wavespeed');
  });

  it('maps the provider payload and runs through shared estimate/simulation', async () => {
    const spec = voiceSampleSpec();

    await expect(
      projectData.validateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir,
        spec,
      })
    ).resolves.toMatchObject({
      valid: true,
      providerPayload: {
        text: 'The city is a problem of patience, not force.',
        voice: 'voice_urban_normal',
        output_format: 'mp3_44100_128',
        language_code: 'en',
        voice_settings: {
          similarity_boost: 0.74,
          stability: 0.42,
          use_speaker_boost: true,
        },
      },
    });

    const created = await projectData.createMediaGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec,
    });
    await expect(
      projectData.estimateMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir,
        specId: created.id,
      })
    ).resolves.toMatchObject({
      estimate: {
        state: 'priced',
        provider: 'elevenlabs',
        model: 'eleven_v3',
        mediaKind: 'audio',
        costApprovalToken: expect.stringMatching(/^sha256:/),
      },
    });

    await expect(
      projectData.runMediaGenerationSpec({
        projectName: 'constantinople',
        homeDir,
        specId: created.id,
        simulate: true,
      })
    ).resolves.toMatchObject({
      run: {
        provider: 'elevenlabs',
        model: 'eleven_v3',
        simulated: true,
        outputs: [
          {
            mimeType: 'audio/mp3',
            projectRelativePath: 'generated/media/normal-voice.mp3',
          },
        ],
      },
    });
  });

  function voiceSampleSpec(): CastVoiceSampleGenerationSpec {
    return {
      purpose: 'cast.voice-sample',
      target: { kind: 'castMember', id: castMemberId },
      modelChoice: 'elevenlabs/eleven_v3',
      voiceId: 'voice_urban_normal',
      text: 'The city is a problem of patience, not force.',
      referenceName: 'normal-voice',
      referencePurpose: 'calm strategic baseline',
      voiceSettings: {
        stability: 0.42,
        similarityBoost: 0.74,
        useSpeakerBoost: true,
      },
      outputFormat: 'mp3_44100_128',
      languageCode: 'en',
      title: 'Urban normal voice',
    };
  }
});
