import fs from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { ProjectRelativePath } from '../../client/index.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { createProjectDataService } from '../project-data-service.js';
import { sceneDialogueAudio, scenes } from '../schema/index.js';
import { createDialogueAudioReadyProject } from '../testing/dialogue-audio-template-fixtures.js';

describe('Scene Dialogue Audio generation', () => {
  it('estimates from model and text without a project, setup, or Cast Voice', async () => {
    const text = 'The barrel is still angry.';
    const report = await createProjectDataService().estimateSceneDialogueAudioDraft({
      estimate: {
        modelChoice: 'elevenlabs/eleven_v3',
        text,
      },
    });

    expect(report).toMatchObject({
      provider: 'elevenlabs',
      model: 'eleven_v3',
      billableUnits: { characterCount: text.length },
    });
    expect(report.estimatedCostUsd).toBeGreaterThan(0);
  });

  it('records the exact generation run on an attached dialogue audio take', async () => {
    const readyProject = await createDialogueAudioReadyProject();
    if (!readyProject) {
      return;
    }
    const samplePath = 'tmp/source/urban-voice.mp3' as ProjectRelativePath;
    await fs.mkdir(path.dirname(path.join(readyProject.projectPath, samplePath)), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(readyProject.projectPath, samplePath),
      'voice sample'
    );
    const voice = await readyProject.projectData.attachCastVoice({
      homeDir: readyProject.homeDir,
      projectName: 'dialogue-audio-test',
      document: {
        kind: 'castVoiceAttachment',
        castMemberId: 'cast_test0001',
        name: 'urban-primary',
        provider: 'elevenlabs',
        model: 'eleven_v3',
        voiceId: 'voice_urban_primary',
        purpose: 'Primary dialogue voice.',
        sample: {
          sourceProjectRelativePath: samplePath,
          title: 'Urban primary voice sample',
        },
      },
    });

    const report = await readyProject.projectData.generateSceneDialogueAudioTake({
      homeDir: readyProject.homeDir,
      projectName: 'dialogue-audio-test',
      sceneId: readyProject.sceneId,
      turnId: readyProject.dialogueId,
      setup: {
        modelChoice: 'elevenlabs/eleven_v3',
        castVoiceId: voice.voice.id,
        plainText: 'Bronze has no temper.',
        v3Text: 'Bronze has no temper.',
      },
      simulate: true,
    });

    const take = report.context.audioByTurnId[
      readyProject.dialogueId
    ]?.takes[0];
    expect(take?.generationRunId).toMatch(/^media_generation_run_/);
    await expect(
      readyProject.projectData.readGenerationRun({
        homeDir: readyProject.homeDir,
        projectName: 'dialogue-audio-test',
        runId: take!.generationRunId,
      })
    ).resolves.toMatchObject({ id: take!.generationRunId, status: 'simulated' });
  });

  it('rejects a missing Dialogue Turn before saving setup or running generation', async () => {
    const readyProject = await createDialogueAudioReadyProject();
    if (!readyProject) {
      return;
    }
    await expect(
      readyProject.projectData.generateSceneDialogueAudioTake({
        homeDir: readyProject.homeDir,
        projectName: 'dialogue-audio-test',
        sceneId: readyProject.sceneId,
        turnId: 'turn_missing',
        setup: {},
        simulate: true,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_ASSET_FILE_OWNER_MISSING',
    });
    const workspace = await readyProject.projectData.readSceneDialogueAudioWorkspace({
      homeDir: readyProject.homeDir,
      projectName: 'dialogue-audio-test',
      sceneId: readyProject.sceneId,
    });
    expect(workspace.audioByTurnId[readyProject.dialogueId]).toBeUndefined();
  });

  it('preserves Dialogue Audio after its source Scene is deleted', async () => {
    const readyProject = await createDialogueAudioReadyProject();
    if (!readyProject) {
      return;
    }
    const samplePath = 'tmp/source/historical-voice.mp3' as ProjectRelativePath;
    await fs.mkdir(path.dirname(path.join(readyProject.projectPath, samplePath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(readyProject.projectPath, samplePath), 'voice sample');
    const voice = await readyProject.projectData.attachCastVoice({
      homeDir: readyProject.homeDir,
      projectName: 'dialogue-audio-test',
      document: {
        kind: 'castVoiceAttachment',
        castMemberId: 'cast_test0001',
        name: 'urban-historical',
        provider: 'elevenlabs',
        model: 'eleven_v3',
        voiceId: 'voice_urban_historical',
        purpose: 'Historical dialogue voice.',
        sample: {
          sourceProjectRelativePath: samplePath,
          title: 'Historical voice sample',
        },
      },
    });
    await readyProject.projectData.updateSceneDialogueAudioSetup({
      homeDir: readyProject.homeDir,
      projectName: 'dialogue-audio-test',
      sceneId: readyProject.sceneId,
      turnId: readyProject.dialogueId,
      setup: { castVoiceId: voice.voice.id },
    });

    await readyProject.projectData.applyScreenplayOperations({
      homeDir: readyProject.homeDir,
      projectName: 'dialogue-audio-test',
      operations: [{
        operation: 'scene.delete',
        scene: { id: readyProject.sceneId },
      }],
    });

    const { session } = await openProjectSession({
      homeDir: readyProject.homeDir,
      projectName: 'dialogue-audio-test',
    });
    try {
      expect(session.db.select().from(scenes)
        .where(eq(scenes.id, readyProject.sceneId)).get()).toBeUndefined();
      expect(session.db.select().from(sceneDialogueAudio)
        .where(eq(sceneDialogueAudio.sceneId, readyProject.sceneId)).get()).toMatchObject({
        turnId: readyProject.dialogueId,
        castMemberId: 'cast_test0001',
      });
    } finally {
      session.close();
    }
  });
});
