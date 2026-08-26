import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProjectRelativePath } from '../../client/index.js';
import { createDialogueAudioReadyProject } from '../testing/dialogue-audio-template-fixtures.js';

describe('Scene Dialogue Audio attachments', () => {
  it('requires the dialogue turn to belong to the target Scene', async () => {
    const ready = await createDialogueAudioReadyProject();
    if (!ready) {
      return;
    }
    const voiceSamplePath = 'tmp/urban-voice.mp3' as ProjectRelativePath;
    const dialogueAudioPath = 'tmp/urban-dialogue.mp3' as ProjectRelativePath;
    await fs.mkdir(path.join(ready.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(ready.projectPath, voiceSamplePath), 'voice sample');
    await fs.writeFile(path.join(ready.projectPath, dialogueAudioPath), 'dialogue audio');
    const voice = await ready.projectData.attachCastVoice({
      homeDir: ready.homeDir,
      document: {
        kind: 'castVoiceAttachment',
        castMemberId: 'cast_test0001',
        name: 'urban-dialogue-voice',
        provider: 'elevenlabs',
        model: 'eleven_v3',
        voiceId: 'voice_urban_dialogue',
        purpose: 'dialogue audio',
        sample: {
          sourceProjectRelativePath: voiceSamplePath,
          title: 'Urban dialogue voice',
        },
      },
    });
    await ready.projectData.updateSceneDialogueAudioSetup({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
      turnId: ready.dialogueId,
      setup: { castVoiceId: voice.voice.id },
    });
    const generationProvenance = {
      provider: 'elevenlabs',
      model: 'eleven_v3',
      mediaKind: 'audio' as const,
      prompt: 'Bronze has no temper. Men give it one.',
      request: { text: 'Bronze has no temper. Men give it one.' },
    };

    await expect(ready.projectData.attachGenerationMedia({
      homeDir: ready.homeDir,
      purpose: 'scene.dialogue-audio',
      target: {
        kind: 'sceneDialogue',
        sceneId: 'scene_wrong',
        turnId: ready.dialogueId,
      },
      sourceProjectRelativePath: dialogueAudioPath,
      generationProvenance,
    })).rejects.toMatchObject({ code: 'CORE_DIALOGUE_AUDIO_SETUP_REQUIRED' });

    await expect(ready.projectData.attachGenerationMedia({
      homeDir: ready.homeDir,
      purpose: 'scene.dialogue-audio',
      target: {
        kind: 'sceneDialogue',
        sceneId: ready.sceneId,
        turnId: ready.dialogueId,
      },
      sourceProjectRelativePath: dialogueAudioPath,
      generationProvenance,
    })).resolves.toMatchObject({
      valid: true,
      target: {
        kind: 'sceneDialogue',
        sceneId: ready.sceneId,
        turnId: ready.dialogueId,
      },
    });
  });
});
