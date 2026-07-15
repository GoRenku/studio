import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService, type ProjectRelativePath } from '../index.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import {
  castMembers,
  castVoices,
  mediaGenerationSpecs,
  sceneDialogueAudio,
  sceneDialogueAudioTakes,
  sceneShotLists,
  sceneShotVideoTakes,
  sceneShotVideoTakeVideos,
} from '../schema/index.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';

describe('export production assets', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-export-production-assets-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('exports only picked Take video and its exact included Dialogue Audio Take', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const video = await fixture(created.projectPath, homeDir, {
      path: 'takes/final.mp4', mediaKind: 'video', title: 'Final video', role: 'video',
    });
    const dialogue = await fixture(created.projectPath, homeDir, {
      path: 'dialogue/line.wav', mediaKind: 'audio', title: 'Dialogue line', role: 'dialogue-audio',
    });
    const sample = await fixture(created.projectPath, homeDir, {
      path: 'cast/sample.wav', mediaKind: 'audio', title: 'Voice sample', role: 'voice-sample',
      target: { kind: 'castMember', castMemberId: 'cast_test0001' },
    });
    await fixture(created.projectPath, homeDir, {
      path: 'storyboard/excluded.png', mediaKind: 'image', title: 'Excluded image', role: 'storyboard-image',
    });

    const session = openProjectStore({ projectFolder: created.projectPath, create: false });
    const now = '2026-07-14T10:00:00.000Z';
    try {
      let shotListId = session.db.select({ id: sceneShotLists.id }).from(sceneShotLists).get()?.id;
      if (!shotListId) {
        shotListId = 'shot_list_export';
        session.db.insert(sceneShotLists).values({
          id: shotListId, sceneId: 'scene_test0001', title: 'Export shots',
          document: JSON.stringify({ kind: 'sceneShotList', sceneId: 'scene_test0001', shots: [] }),
          createdAt: now, updatedAt: now,
        }).run();
      }
      const castMemberId = session.db.select({ id: castMembers.id }).from(castMembers).get()!.id;
      session.db.insert(castVoices).values({
        id: 'cast_voice_export', castMemberId, name: 'Export voice', purpose: 'dialogue',
        sampleAssetId: sample.assetId, sortOrder: 0, createdAt: now, updatedAt: now,
      }).run();
      session.db.insert(sceneDialogueAudio).values({
        id: 'scene_dialogue_audio_export', sceneId: 'scene_test0001', dialogueId: 'dialogue_export',
        castMemberId, castVoiceId: 'cast_voice_export', modelChoice: 'test/model', plainText: 'Line',
        v3Text: 'Line', voiceSettingsJson: '{}', outputFormat: 'mp3_44100_128', createdAt: now, updatedAt: now,
      }).run();
      session.db.insert(sceneDialogueAudioTakes).values({
        id: 'dialogue_take_export', sceneDialogueAudioId: 'scene_dialogue_audio_export',
        assetId: dialogue.assetId, assetFileId: dialogue.files[0]!.id, modelChoice: 'test/model',
        castVoiceId: 'cast_voice_export', castVoiceName: 'Export voice', provider: 'test',
        providerVoiceId: 'voice', providerTextSnapshot: 'Line', plainTextSnapshot: 'Line',
        v3TextSnapshot: 'Line', textTreatment: 'plain', voiceSettingsSnapshotJson: '{}',
        outputFormat: 'mp3_44100_128', createdAt: now, updatedAt: now,
      }).run();
      session.db.insert(sceneShotVideoTakes).values({
        id: 'take_export', sceneId: 'scene_test0001', sourceShotListId: shotListId,
        title: 'Picked Take', isPicked: true, historySnapshot: '{}', createdAt: now, updatedAt: now,
      }).run();
      session.db.insert(sceneShotVideoTakeVideos).values({
        takeId: 'take_export', assetId: video.assetId, assetFileId: video.files[0]!.id,
        createdAt: now, updatedAt: now,
      }).run();
      session.db.insert(mediaGenerationSpecs).values({
        id: 'spec_export', purpose: 'shot.video-take', targetKind: 'sceneShotVideoTake',
        targetId: 'take_export', provider: 'test', model: 'video', valuesJson: '{}',
        referencesJson: JSON.stringify([{
          id: 'dialogue-reference', included: true,
          placement: {
            kind: 'slot', sectionId: 'dialogue', slotId: 'dialogue-audio',
            subject: { kind: 'sceneDialogue', id: 'dialogue_export' },
          },
          reference: { kind: 'asset-file', assetId: dialogue.assetId, assetFileId: dialogue.files[0]!.id },
        }]), createdAt: now, updatedAt: now,
      }).run();
    } finally {
      session.close();
    }

    const dryRun = await projectData.exportProductionAssets({
      projectName: 'constantinople', homeDir, dryRun: true,
    });
    expect(dryRun.copiedFileCount).toBe(2);
    await expect(fs.access(path.join(created.projectPath, 'production-assets'))).rejects.toThrow();

    const report = await projectData.exportProductionAssets({
      projectName: 'constantinople', homeDir,
    });
    expect(report).toMatchObject({ copiedFileCount: 2, skippedFileCount: 0 });
    const files = await listFiles(path.join(created.projectPath, 'production-assets'));
    expect(files.filter((file) => !file.endsWith('manifest.json'))).toHaveLength(2);
    expect(files.some((file) => file.endsWith('/video.mp4'))).toBe(true);
    expect(files.some((file) => file.endsWith('/dialogue-export.wav'))).toBe(true);
    expect(files.some((file) => file.endsWith('.png'))).toBe(false);
  }, 10000);

});

async function fixture(
  projectPath: string,
  homeDir: string,
  input: {
    path: string;
    mediaKind: 'image' | 'audio' | 'video';
    title: string;
    role: string;
    target?: { kind: 'castMember'; castMemberId: string };
  }
) {
  const absolutePath = path.join(projectPath, input.path);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, `${input.title} bytes`);
  return createTestAssetFixture({
    projectName: 'constantinople', homeDir,
    target: input.target ?? { kind: 'scene', sceneId: 'scene_test0001' },
    type: input.mediaKind, mediaKind: input.mediaKind, title: input.title,
    projectRelativePath: input.path as ProjectRelativePath, fileRole: 'primary', role: input.role,
  });
}

async function listFiles(folder: string): Promise<string[]> {
  const entries = await fs.readdir(folder, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const child = path.join(folder, entry.name);
    return entry.isDirectory() ? listFiles(child) : [child];
  }));
  return nested.flat();
}
