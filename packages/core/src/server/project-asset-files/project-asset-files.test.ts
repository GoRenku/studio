import fs from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  MediaGenerationSpecRecord,
  ProjectRelativePath,
} from '../../client/index.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { createDialogueAudioReadyProject } from '../testing/dialogue-audio-template-fixtures.js';
import {
  createProjectAssetFileWriteSet,
  persistProjectAssetFileSync,
  persistSceneStoryboardShotFilesSync,
  resolveProjectAssetGenerationOutput,
  rollbackProjectAssetFileWriteSetSync,
  writeProjectTemporaryFile,
} from './index.js';

const PROJECT_NAME = 'dialogue-audio-test';
const NOW = '2026-07-08T00:00:00.000Z';

describe('project asset file storage', () => {
  let projectPath: string;
  let session: DatabaseSession;
  let sceneId: string;
  let dialogueId: string;

  beforeEach(async () => {
    const readyProject = await createDialogueAudioReadyProject();
    if (!readyProject) {
      return;
    }
    projectPath = readyProject.projectPath;
    sceneId = readyProject.sceneId;
    dialogueId = readyProject.dialogueId;
    session = (await openProjectSession({
      projectName: PROJECT_NAME,
      homeDir: readyProject.homeDir,
    })).session;
  });

  it('writes temporary files under tmp without registering asset files', async () => {
    const written = await writeProjectTemporaryFile({
      projectFolder: projectPath,
      destination: { kind: 'generation.media', purpose: 'cast.voice-sample' },
      fileNameHint: 'Urban Voice.mp3',
      contents: new TextEncoder().encode('voice bytes'),
    });

    expect(written.projectRelativePath).toMatch(/^tmp\/media\/urban-voice\.mp3$/);
    await expect(fs.readFile(written.absolutePath, 'utf8')).resolves.toBe(
      'voice bytes'
    );
    expect(
      countAssetFilesWithProjectPath(session, written.projectRelativePath)
    ).toBe(0);
  });

  it('persists cast voice samples from the reference name', async () => {
    await writeProjectFile('tmp/source/voice.mp3', 'voice bytes');
    insertReadyAsset(session, {
      assetId: 'asset_voice_sample',
      type: 'cast_voice_sample',
      mediaKind: 'audio',
      title: 'Voice sample',
    });

    const file = persistProjectAssetFileSync({
      session,
      projectFolder: projectPath,
      assetId: 'asset_voice_sample',
      assetFileId: 'asset_file_voice_sample',
      sourceProjectRelativePath: projectRelativePath('tmp/source/voice.mp3'),
      destination: {
        kind: 'cast.voiceSample',
        castMemberId: 'cast_test0001',
        castVoiceId: 'cast_voice_test',
        referenceName: 'normal-voice',
      },
      fileRole: 'source',
      mediaKind: 'audio',
      now: NOW,
    });

    expect(file.projectRelativePath).toBe(
      'cast/urban/voice-samples/normal-voice.mp3'
    );
  });

  it('allocates generated cast voice sample names from the reference name and output format', async () => {
    const placement = await resolveProjectAssetGenerationOutput({
      session,
      projectFolder: projectPath,
      specRecord: {
        id: 'media_generation_spec_voice_sample',
        purpose: 'cast.voice-sample',
        target: { kind: 'castMember', id: 'cast_test0001' },
        modelChoice: 'elevenlabs/eleven_v3',
        title: 'Urban normal voice',
        spec: {
          purpose: 'cast.voice-sample',
          target: { kind: 'castMember', id: 'cast_test0001' },
          modelChoice: 'elevenlabs/eleven_v3',
          voiceId: 'voice_urban_normal',
          text: 'The city is a problem of patience, not force.',
          referenceName: 'normal-voice',
          referencePurpose: 'calm strategic baseline',
          outputFormat: 'pcm_44100',
          title: 'Urban normal voice',
        },
        createdAt: NOW,
        updatedAt: NOW,
      } as MediaGenerationSpecRecord,
      outputCount: 1,
    });

    expect(placement.projectRelativeRoot).toBe('cast/urban/voice-samples');
    expect(placement.outputNames).toEqual(['normal-voice.wav']);
  });

  it('persists scene dialogue audio with stable dialogue order and take numbering', async () => {
    await writeProjectFile('tmp/source/dialogue.mp3', 'dialogue bytes');
    insertReadyAsset(session, {
      assetId: 'asset_dialogue_audio_0',
      type: 'scene_dialogue_audio',
      mediaKind: 'audio',
      title: 'Dialogue audio 0',
    });
    insertReadyAsset(session, {
      assetId: 'asset_dialogue_audio_1',
      type: 'scene_dialogue_audio',
      mediaKind: 'audio',
      title: 'Dialogue audio 1',
    });

    const first = persistDialogueAudioFile({
      assetId: 'asset_dialogue_audio_0',
      assetFileId: 'asset_file_dialogue_audio_0',
    });
    const second = persistDialogueAudioFile({
      assetId: 'asset_dialogue_audio_1',
      assetFileId: 'asset_file_dialogue_audio_1',
    });

    expect(first.projectRelativePath).toBe(
      'audio/the-wall/cannon-test/0100-urban-00.mp3'
    );
    expect(second.projectRelativePath).toBe(
      'audio/the-wall/cannon-test/0100-urban-01.mp3'
    );
  });

  it('persists storyboard batches into one iteration folder', async () => {
    await writeProjectFile('tmp/storyboards/shot-a.png', 'shot a');
    await writeProjectFile('tmp/storyboards/shot-b.png', 'shot b');
    insertReadyAsset(session, {
      assetId: 'asset_storyboard_0',
      type: 'scene_storyboard_image',
      mediaKind: 'image',
      title: 'Storyboard 0',
    });
    insertReadyAsset(session, {
      assetId: 'asset_storyboard_1',
      type: 'scene_storyboard_image',
      mediaKind: 'image',
      title: 'Storyboard 1',
    });

    const files = persistSceneStoryboardShotFilesSync({
      session,
      projectFolder: projectPath,
      sceneId,
      files: [
        {
          assetId: 'asset_storyboard_0',
          assetFileId: 'asset_file_storyboard_0',
          shotId: 'shot_0',
          shotOrdinal: 1,
          sourceProjectRelativePath: projectRelativePath('tmp/storyboards/shot-a.png'),
        },
        {
          assetId: 'asset_storyboard_1',
          assetFileId: 'asset_file_storyboard_1',
          shotId: 'shot_1',
          shotOrdinal: 2,
          sourceProjectRelativePath: projectRelativePath('tmp/storyboards/shot-b.png'),
        },
      ],
      now: NOW,
    });

    expect(files.map((file) => file.assetFile.projectRelativePath)).toEqual([
      'storyboards/the-wall/cannon-test/00-iteration/shot-01.png',
      'storyboards/the-wall/cannon-test/00-iteration/shot-02.png',
    ]);
  });

  it('rolls back only files created through the storage write set', async () => {
    await writeProjectFile('tmp/source/lookbook.png', 'lookbook bytes');
    insertReadyAsset(session, {
      assetId: 'asset_rollback',
      type: 'lookbook_image',
      mediaKind: 'image',
      title: 'Rollback',
    });
    const writeSet = createProjectAssetFileWriteSet({ projectFolder: projectPath });

    const file = persistProjectAssetFileSync({
      session,
      projectFolder: projectPath,
      writeSet,
      assetId: 'asset_rollback',
      assetFileId: 'asset_file_rollback',
      sourceProjectRelativePath: projectRelativePath('tmp/source/lookbook.png'),
      destination: {
        kind: 'visualLanguage.lookbookImage',
        titleHint: 'Rollback',
      },
      fileRole: 'source',
      mediaKind: 'image',
      now: NOW,
    });

    const copiedPath = resolveProjectRelativePath(
      projectPath,
      file.projectRelativePath as ProjectRelativePath
    );
    await expect(fs.access(copiedPath)).resolves.toBeUndefined();
    rollbackProjectAssetFileWriteSetSync(writeSet);
    await expect(fs.access(copiedPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects generated and research roots as durable asset-file records', () => {
    insertReadyAsset(session, {
      assetId: 'asset_generated_source',
      type: 'image',
      mediaKind: 'image',
      title: 'Generated source',
    });

    expect(() =>
      insertAssetFileRecord(session, {
        id: 'asset_file_generated_source',
        assetId: 'asset_generated_source',
        role: 'source',
        projectRelativePath: projectRelativePath('generated/media/source.png'),
        mediaKind: 'image',
        sizeBytes: 10,
        createdAt: NOW,
        updatedAt: NOW,
      })
    ).toThrow(ProjectDataError);
    expect(() =>
      insertAssetFileRecord(session, {
        id: 'asset_file_research_source',
        assetId: 'asset_generated_source',
        role: 'source',
        projectRelativePath: projectRelativePath('research/source.png'),
        mediaKind: 'image',
        sizeBytes: 10,
        createdAt: NOW,
        updatedAt: NOW,
      })
    ).toThrow(ProjectDataError);
  });

  function persistDialogueAudioFile(input: {
    assetId: string;
    assetFileId: string;
  }) {
    return persistProjectAssetFileSync({
      session,
      projectFolder: projectPath,
      assetId: input.assetId,
      assetFileId: input.assetFileId,
      sourceProjectRelativePath: projectRelativePath('tmp/source/dialogue.mp3'),
      destination: {
        kind: 'scene.dialogueAudio',
        sceneId,
        dialogueId,
        sceneDialogueAudioId: 'scene_dialogue_audio_test',
        dialogueAudioTakeId: input.assetFileId,
      },
      fileRole: 'primary',
      mediaKind: 'audio',
      now: NOW,
    });
  }

  async function writeProjectFile(
    projectRelativePathInput: string,
    contents: string
  ): Promise<void> {
    const projectRelativePath = normalizeProjectRelativePath(
      projectRelativePathInput
    );
    const absolutePath = resolveProjectRelativePath(projectPath, projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, contents, 'utf8');
  }
});

function projectRelativePath(input: string): ProjectRelativePath {
  return normalizeProjectRelativePath(input);
}

function insertReadyAsset(
  session: DatabaseSession,
  input: {
    assetId: string;
    type: string;
    mediaKind: string;
    title: string;
  }
): void {
  insertAssetRecord(session, {
    id: input.assetId,
    type: input.type,
    mediaKind: input.mediaKind,
    title: input.title,
    origin: 'imported',
    availability: 'ready',
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function countAssetFilesWithProjectPath(
  session: DatabaseSession,
  projectRelativePath: ProjectRelativePath
): number {
  const rows = session.db.all<{
    count: number;
  }>(
    sql`select count(*) as count from asset_file where project_relative_path = ${projectRelativePath}`
  );
  return rows[0]?.count ?? 0;
}
