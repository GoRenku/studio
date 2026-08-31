import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ProjectRelativePath } from '../../client/index.js';
import { createDialogueAudioReadyProject } from '../testing/dialogue-audio-template-fixtures.js';

describe('Scene Dialogue Audio Take selection', () => {
  it('replaces one complete current setup document and rejects partial or mismatched documents', async () => {
    const ready = await createDialogueAudioReadyProject();
    if (!ready) {
      return;
    }
    const castVoiceId = await prepareDialogueAudio(ready);
    const setup = {
      purpose: 'scene.dialogue-audio' as const,
      target: {
        kind: 'sceneDialogue' as const,
        sceneId: ready.sceneId,
        turnId: ready.dialogueId,
      },
      modelChoice: 'elevenlabs/eleven_v3' as const,
      castVoiceId,
      plainText: 'Exact plain dialogue.',
      v3Text: '[calm] Exact dialogue.',
      voiceSettings: { stability: 0.5 },
      outputFormat: 'mp3_44100_128',
      languageCode: null,
    };
    const report = await ready.projectData.replaceSceneDialogueAudioSetup({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
      turnId: ready.dialogueId,
      setup,
    });
    expect(report.context.audioByTurnId[ready.dialogueId]).toMatchObject({
      castVoiceId,
      plainText: 'Exact plain dialogue.',
      v3Text: '[calm] Exact dialogue.',
      voiceSettings: { stability: 0.5 },
    });
    await expect(ready.projectData.replaceSceneDialogueAudioSetup({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
      turnId: ready.dialogueId,
      setup: { ...setup, target: { ...setup.target, turnId: 'dialogue_wrong' } },
    })).rejects.toMatchObject({ code: 'CORE_DIALOGUE_AUDIO_SETUP_DOCUMENT_INVALID' });
    await expect(ready.projectData.replaceSceneDialogueAudioSetup({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
      turnId: ready.dialogueId,
      setup: { purpose: 'scene.dialogue-audio' },
    })).rejects.toMatchObject({ code: 'CORE_DIALOGUE_AUDIO_SETUP_DOCUMENT_INVALID' });
  });

  it('selects, replaces, clears, and never restores or creates an implicit selection', async () => {
    const ready = await createDialogueAudioReadyProject();
    if (!ready) {
      return;
    }
    await prepareDialogueAudio(ready);
    const first = await attachTake(ready, 'tmp/dialogue-one.mp3');
    const second = await attachTake(ready, 'tmp/dialogue-two.mp3');

    let workspace = await ready.projectData.readSceneDialogueAudioWorkspace({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
    });
    expect(workspace.audioByTurnId[ready.dialogueId]?.selectedTakeId).toBeNull();

    await ready.projectData.selectSceneDialogueAudioTake({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
      turnId: ready.dialogueId,
      takeId: first.takeId,
    });
    workspace = await ready.projectData.selectSceneDialogueAudioTake({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
      turnId: ready.dialogueId,
      takeId: second.takeId,
    }).then((report) => report.context);
    expect(workspace.audioByTurnId[ready.dialogueId]?.selectedTakeId).toBe(second.takeId);
    const shotPlan = await ready.projectData.createShotPlan({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
      title: 'Dialogue continuity plan',
      coverage: null,
      shots: [],
    });
    const generationContext = await ready.projectData.readMediaGenerationContext({
      homeDir: ready.homeDir,
      purpose: 'shot-plan.video-generation',
      target: { kind: 'shotPlan', id: shotPlan.shotPlan.id },
    });
    const suggestion = generationContext.suggestedReferences.find(
      (candidate) => candidate.role === 'dialogue-audio',
    );
    expect(suggestion?.candidates).toHaveLength(2);
    expect(suggestion?.candidates.filter((candidate) => candidate.isWorkflowSelected))
      .toEqual([expect.objectContaining({ assetId: second.assetId })]);

    await expect(ready.projectData.selectSceneDialogueAudioTake({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
      turnId: 'dialogue_wrong',
      takeId: second.takeId,
    })).rejects.toMatchObject({ code: 'CORE_DIALOGUE_AUDIO_TAKE_INVALID' });
    await expect(ready.projectData.selectSceneDialogueAudioTake({
      homeDir: ready.homeDir,
      sceneId: 'scene_wrong',
      turnId: ready.dialogueId,
      takeId: second.takeId,
    })).rejects.toMatchObject({ code: 'CORE_DIALOGUE_AUDIO_TAKE_INVALID' });

    const discarded = await ready.projectData.deleteSceneDialogueAudioTake({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
      turnId: ready.dialogueId,
      takeId: second.takeId,
    });
    expect(discarded.context.audioByTurnId[ready.dialogueId]?.selectedTakeId).toBeNull();
    await ready.projectData.restoreTrashItem({
      projectName: 'dialogue-audio-test',
      homeDir: ready.homeDir,
      trashItemId: discarded.recovery!.trashItemIds[0]!,
    });
    workspace = await ready.projectData.readSceneDialogueAudioWorkspace({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
    });
    expect(workspace.audioByTurnId[ready.dialogueId]?.takes).toHaveLength(2);
    expect(workspace.audioByTurnId[ready.dialogueId]?.selectedTakeId).toBeNull();

    await ready.projectData.selectSceneDialogueAudioTake({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
      turnId: ready.dialogueId,
      takeId: first.takeId,
    });
    const cleared = await ready.projectData.clearSceneDialogueAudioTakeSelection({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
      turnId: ready.dialogueId,
    });
    expect(cleared.context.audioByTurnId[ready.dialogueId]?.selectedTakeId).toBeNull();
  });

  it('rejects generic Asset discard for an active Dialogue Take', async () => {
    const ready = await createDialogueAudioReadyProject();
    if (!ready) {
      return;
    }
    await prepareDialogueAudio(ready);
    const take = await attachTake(ready, 'tmp/dialogue-generic-discard.mp3');
    await ready.projectData.selectSceneDialogueAudioTake({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
      turnId: ready.dialogueId,
      takeId: take.takeId,
    });

    await expect(ready.projectData.discardAsset({
      projectName: 'dialogue-audio-test',
      homeDir: ready.homeDir,
      owner: { kind: 'scene', id: ready.sceneId },
      assetId: take.assetId,
    })).rejects.toMatchObject({
      code: 'CORE_DIALOGUE_AUDIO_TAKE_ASSET_DISCARD_INVALID',
    });

    const workspace = await ready.projectData.readSceneDialogueAudioWorkspace({
      homeDir: ready.homeDir,
      sceneId: ready.sceneId,
    });
    expect(workspace.audioByTurnId[ready.dialogueId]).toMatchObject({
      selectedTakeId: take.takeId,
      takes: [expect.objectContaining({ takeId: take.takeId, assetId: take.assetId })],
    });
    await expect(ready.projectData.listAssets({
      projectName: 'dialogue-audio-test',
      homeDir: ready.homeDir,
      owner: { kind: 'scene', id: ready.sceneId },
      type: 'scene_dialogue_audio',
    })).resolves.toEqual([
      expect.objectContaining({ id: take.assetId }),
    ]);
  });
});

async function prepareDialogueAudio(
  ready: NonNullable<Awaited<ReturnType<typeof createDialogueAudioReadyProject>>>,
) {
  const samplePath = 'tmp/urban-selection-voice.mp3' as ProjectRelativePath;
  await fs.mkdir(path.join(ready.projectPath, 'tmp'), { recursive: true });
  await fs.writeFile(path.join(ready.projectPath, samplePath), 'voice sample');
  const voice = await ready.projectData.attachCastVoice({
    homeDir: ready.homeDir,
    document: {
      kind: 'castVoiceAttachment',
      castMemberId: 'cast_test0001',
      name: 'urban-selection-voice',
      provider: 'elevenlabs',
      model: 'eleven_v3',
      voiceId: 'voice_urban_selection',
      purpose: 'dialogue audio',
      sample: {
        sourceProjectRelativePath: samplePath,
        title: 'Urban selection voice',
      },
    },
  });
  await ready.projectData.updateSceneDialogueAudioSetup({
    homeDir: ready.homeDir,
    sceneId: ready.sceneId,
    turnId: ready.dialogueId,
    setup: { castVoiceId: voice.voice.id },
  });
  return voice.voice.id;
}

async function attachTake(
  ready: NonNullable<Awaited<ReturnType<typeof createDialogueAudioReadyProject>>>,
  sourcePath: string,
) {
  await fs.writeFile(path.join(ready.projectPath, sourcePath), sourcePath);
  const report = await ready.projectData.attachGenerationMedia({
    homeDir: ready.homeDir,
    purpose: 'scene.dialogue-audio',
    target: {
      kind: 'sceneDialogue',
      sceneId: ready.sceneId,
      turnId: ready.dialogueId,
    },
    sourceProjectRelativePath: sourcePath,
    generationProvenance: {
      provider: 'elevenlabs',
      model: 'eleven_v3',
      mediaKind: 'audio',
      prompt: 'Bronze has no temper. Men give it one.',
      request: { text: 'Bronze has no temper. Men give it one.' },
    },
  });
  const workspace = await ready.projectData.readSceneDialogueAudioWorkspace({
    homeDir: ready.homeDir,
    sceneId: ready.sceneId,
  });
  const take = workspace.audioByTurnId[ready.dialogueId]?.takes.find(
    (candidate) => candidate.assetId === report.asset.id,
  );
  if (!take) {
    throw new Error('Attached Take was not found.');
  }
  return take;
}
