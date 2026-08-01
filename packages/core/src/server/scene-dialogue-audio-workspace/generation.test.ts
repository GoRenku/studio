import fs from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { ProjectRelativePath } from '../../client/index.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { createProjectDataService } from '../project-data-service.js';
import { scenes } from '../schema/index.js';
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
      dialogueId: readyProject.dialogueId,
      setup: {
        modelChoice: 'elevenlabs/eleven_v3',
        castVoiceId: voice.voice.id,
        plainText: 'Bronze has no temper.',
        v3Text: 'Bronze has no temper.',
      },
      simulate: true,
    });

    const take = report.context.audioByDialogueId[
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

  it('rejects an invalid dialogue destination before saving setup or running generation', async () => {
    const readyProject = await createDialogueAudioReadyProject();
    if (!readyProject) {
      return;
    }
    const { session } = await openProjectSession({
      homeDir: readyProject.homeDir,
      projectName: 'dialogue-audio-test',
    });
    const row = session.db
      .select({ blocksJson: scenes.blocksJson })
      .from(scenes)
      .where(eq(scenes.id, readyProject.sceneId))
      .get()!;
    const blocks = JSON.parse(row.blocksJson) as Array<Record<string, unknown>>;
    blocks.forEach((block) => delete block.dialogueOrderKey);
    session.db
      .update(scenes)
      .set({ blocksJson: JSON.stringify(blocks) })
      .where(eq(scenes.id, readyProject.sceneId))
      .run();
    session.close();

    await expect(
      readyProject.projectData.generateSceneDialogueAudioTake({
        homeDir: readyProject.homeDir,
        projectName: 'dialogue-audio-test',
        sceneId: readyProject.sceneId,
        dialogueId: readyProject.dialogueId,
        setup: {},
        simulate: true,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_ASSET_FILE_DIALOGUE_ORDER_KEY_MISSING',
    });
    const workspace = await readyProject.projectData.readSceneDialogueAudioWorkspace({
      homeDir: readyProject.homeDir,
      projectName: 'dialogue-audio-test',
      sceneId: readyProject.sceneId,
    });
    expect(workspace.audioByDialogueId[readyProject.dialogueId]).toBeUndefined();
  });
});
