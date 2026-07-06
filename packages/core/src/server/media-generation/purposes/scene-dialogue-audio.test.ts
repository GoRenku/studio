import fs from 'node:fs/promises';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CastVoiceAttachmentDocument,
  ProjectRelativePath,
} from '../../../client/index.js';
import {
  createDeterministicIdGenerator,
  type ProjectDataService,
} from '../../index.js';
import { createDialogueAudioReadyProject } from '../../testing/dialogue-audio-template-fixtures.js';

describe('Scene Dialogue Audio generation', () => {
  let homeDir: string;
  let projectData: ProjectDataService;
  let projectPath: string;
  let sceneId: string;
  let dialogueId: string;

  beforeEach(async () => {
    const readyProject = await createDialogueAudioReadyProject();
    if (!readyProject) {
      return;
    }
    homeDir = readyProject.homeDir;
    projectData = readyProject.projectData;
    projectPath = readyProject.projectPath;
    sceneId = readyProject.sceneId;
    dialogueId = readyProject.dialogueId;
  });

  it('creates a simulated audio take from the shared generation runner output without selecting it', async () => {
    await writeProjectFile(
      'generated/audio/urban-sample.mp3',
      'voice sample bytes',
    );
    const attached = await projectData.attachCastVoice({
      projectName: 'dialogue-audio-test',
      homeDir,
      document: castVoiceAttachment(),
      idGenerator: createDeterministicIdGenerator(),
    });
    const report = await projectData.generateSceneDialogueAudioTake({
      projectName: 'dialogue-audio-test',
      homeDir,
      sceneId,
      dialogueId,
      setup: {
        modelChoice: 'elevenlabs/eleven_v3',
        castVoiceId: attached.voice.id,
        plainText: 'Bronze has no temper. Men give it one.',
        v3Text: 'Bronze has no temper. [shouts] Men give it one.',
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75,
          useSpeakerBoost: true,
        },
        outputFormat: 'mp3_44100_128',
        languageCode: 'en',
      },
      simulate: true,
    });

    const audio = report.context.audioByDialogueId[dialogueId];
    expect(audio).toMatchObject({
      dialogueId,
      v3Text: 'Bronze has no temper. [shouts] Men give it one.',
      takes: [
        expect.objectContaining({
          modelChoice: 'elevenlabs/eleven_v3',
          providerTextSnapshot:
            'Bronze has no temper. [shouts] Men give it one.',
        }),
      ],
    });
    expect(audio?.takes[0]?.assetFileId).toEqual(expect.any(String));
    await expect(
      fs.readdir(
        path.join(projectPath, 'generated/media/scene-dialogue-audio'),
      ),
    ).resolves.toHaveLength(1);
  });

  it('keeps repeated dialogue takes in separate generated audio files', async () => {
    await writeProjectFile(
      'generated/audio/urban-sample.mp3',
      'voice sample bytes',
    );
    const attached = await projectData.attachCastVoice({
      projectName: 'dialogue-audio-test',
      homeDir,
      document: castVoiceAttachment(),
      idGenerator: createDeterministicIdGenerator(),
    });
    const generateInput = {
      projectName: 'dialogue-audio-test',
      homeDir,
      sceneId,
      dialogueId,
      setup: {
        modelChoice: 'elevenlabs/eleven_v3' as const,
        castVoiceId: attached.voice.id,
        plainText: 'Bronze has no temper. Men give it one.',
        v3Text: 'Bronze has no temper. [shouts] Men give it one.',
        outputFormat: 'mp3_44100_128',
      },
      simulate: true,
    };

    await projectData.generateSceneDialogueAudioTake(generateInput);
    const secondReport =
      await projectData.generateSceneDialogueAudioTake(generateInput);

    const audio = secondReport.context.audioByDialogueId[dialogueId];
    expect(audio?.takes).toHaveLength(2);
    const generatedFiles = await fs.readdir(
      path.join(projectPath, 'generated/media/scene-dialogue-audio'),
    );
    expect(generatedFiles).toHaveLength(2);
    expect(new Set(generatedFiles).size).toBe(2);
    expect(generatedFiles.every((file) => file.endsWith('.mp3'))).toBe(true);
  });

  async function writeProjectFile(
    projectRelativePath: string,
    content: string,
  ): Promise<void> {
    const absolutePath = path.join(projectPath, projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
  }
});
function castVoiceAttachment(): CastVoiceAttachmentDocument {
  return {
    kind: 'castVoiceAttachment',
    castMemberId: 'cast_test0001',
    name: 'urban-primary',
    provider: 'elevenlabs',
    model: 'eleven_v3',
    voiceId: 'voice_urban_primary',
    purpose: 'Primary speaking voice for Urban dialogue tests',
    sample: {
      sourceProjectRelativePath:
        'generated/audio/urban-sample.mp3' as ProjectRelativePath,
      title: 'Urban primary voice sample',
    },
  };
}
