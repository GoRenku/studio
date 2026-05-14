import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
  type ProjectRelativePath,
} from '../index.js';
import {
  readAssetFileMetadata,
  runCreateOrSkip,
  writeConfig,
  writeProjectSetup,
} from '../testing/project-data-fixtures.js';

describe('export production assets', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-export-production-assets-test-'));
    const storageRoot = path.join(homeDir, 'projects');
    await writeConfig(homeDir, storageRoot);
  });

  it('exports selected production assets incrementally and prunes stale files', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const masterNarrationPath =
      'working-assets/base/sequences/01-logistics/scenes/01-foundry/clips/001/narration.wav';
    const sequenceVideoPath =
      'working-assets/base/sequences/01-logistics/sequence-video.mp4';
    const sceneTitleCardPath =
      'working-assets/base/sequences/01-logistics/scenes/01-foundry/title-card.png';
    const helperSheetPath = 'working-assets/base/cast/mehmed-sheet.png';
    const localizedSubtitlePath =
      'working-assets/localization/tr-TR/sequences/01-logistics/scenes/01-foundry/clips/001/subtitles.vtt';
    await fs.mkdir(path.dirname(path.join(created.projectPath, masterNarrationPath)), {
      recursive: true,
    });
    await fs.mkdir(path.dirname(path.join(created.projectPath, sequenceVideoPath)), {
      recursive: true,
    });
    await fs.mkdir(path.dirname(path.join(created.projectPath, sceneTitleCardPath)), {
      recursive: true,
    });
    await fs.mkdir(path.dirname(path.join(created.projectPath, helperSheetPath)), {
      recursive: true,
    });
    await fs.mkdir(path.dirname(path.join(created.projectPath, localizedSubtitlePath)), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(created.projectPath, masterNarrationPath),
      'audio bytes'
    );
    await fs.writeFile(
      path.join(created.projectPath, sequenceVideoPath),
      'sequence video bytes'
    );
    await fs.writeFile(
      path.join(created.projectPath, sceneTitleCardPath),
      'scene title card bytes'
    );
    await fs.writeFile(path.join(created.projectPath, helperSheetPath), 'png bytes');
    await fs.writeFile(
      path.join(created.projectPath, localizedSubtitlePath),
      'WEBVTT\n\n00:00.000 --> 00:01.000\nMerhaba\n'
    );

    const narration = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      type: 'narration',
      mediaKind: 'audio',
      title: 'Narration take 1',
      projectRelativePath: masterNarrationPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'narration',
    });
    const sequenceVideo = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'sequence', sequenceId: 'sequence_test0001' },
      type: 'video',
      mediaKind: 'video',
      title: 'Sequence video',
      projectRelativePath: sequenceVideoPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'video',
    });
    const sceneTitleCard = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      type: 'title_card',
      mediaKind: 'image',
      title: 'Scene title card',
      projectRelativePath: sceneTitleCardPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'title-card',
    });
    const helperSheet = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', castMemberId: 'cast_test0002' },
      type: 'character_sheet',
      mediaKind: 'image',
      title: 'Mehmed character sheet',
      projectRelativePath: helperSheetPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'character_sheet',
    });
    const subtitles = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      locale: { localeId: 'locale_test0002' },
      type: 'subtitles',
      mediaKind: 'text',
      title: 'Turkish subtitles',
      projectRelativePath: localizedSubtitlePath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'subtitles',
    });

    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      assetId: narration.assetId,
    });
    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'sequence', sequenceId: 'sequence_test0001' },
      assetId: sequenceVideo.assetId,
    });
    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'scene', sceneId: 'scene_test0001' },
      assetId: sceneTitleCard.assetId,
    });
    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', castMemberId: 'cast_test0002' },
      assetId: helperSheet.assetId,
    });
    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      assetId: subtitles.assetId,
    });

    const firstExport = await projectData.exportProductionAssets({
      projectName: 'constantinople',
      homeDir,
    });

    expect(firstExport).toMatchObject({
      copiedFileCount: 4,
      skippedFileCount: 0,
      prunedFileCount: 0,
    });
    const sequenceTarget = path.join(
      created.projectPath,
      'production-assets',
      'master',
      'sequences',
      '01-the-young-sultan-s-obsession',
      'video.mp4'
    );
    const sceneTarget = path.join(
      created.projectPath,
      'production-assets',
      'master',
      'sequences',
      '01-the-young-sultan-s-obsession',
      'scenes',
      '01-a-throne-facing-an-ancient-city',
      'title-card.png'
    );
    const masterTarget = path.join(
      created.projectPath,
      'production-assets',
      'master',
      'sequences',
      '01-the-young-sultan-s-obsession',
      'scenes',
      '01-a-throne-facing-an-ancient-city',
      'clips',
      '01-the-new-sultan',
      'narration.wav'
    );
    const localizedTarget = path.join(
      created.projectPath,
      'production-assets',
      'localized',
      'tr-TR',
      'sequences',
      '01-the-young-sultan-s-obsession',
      'scenes',
      '01-a-throne-facing-an-ancient-city',
      'clips',
      '01-the-new-sultan',
      'subtitles.vtt'
    );
    await expect(fs.readFile(sequenceTarget, 'utf8')).resolves.toBe(
      'sequence video bytes'
    );
    await expect(fs.readFile(sceneTarget, 'utf8')).resolves.toBe(
      'scene title card bytes'
    );
    await expect(fs.readFile(masterTarget, 'utf8')).resolves.toBe('audio bytes');
    await expect(fs.readFile(localizedTarget, 'utf8')).resolves.toContain(
      'Merhaba'
    );
    await expect(
      fs.access(path.join(created.projectPath, 'production-assets', 'master', 'cast'))
    ).rejects.toThrow();

    const secondExport = await projectData.exportProductionAssets({
      projectName: 'constantinople',
      homeDir,
    });
    expect(secondExport).toMatchObject({
      copiedFileCount: 0,
      skippedFileCount: 4,
      prunedFileCount: 0,
    });
    expect(secondExport.variants[0]?.treeHash).toBe(firstExport.variants[0]?.treeHash);

    await fs.writeFile(path.join(created.projectPath, masterNarrationPath), 'new audio!');
    const changedExport = await projectData.exportProductionAssets({
      projectName: 'constantinople',
      homeDir,
    });
    expect(changedExport.copiedFileCount).toBe(1);
    await expect(fs.readFile(masterTarget, 'utf8')).resolves.toBe('new audio!');

    await projectData.removeAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      assetId: narration.assetId,
    });
    const prunedExport = await projectData.exportProductionAssets({
      projectName: 'constantinople',
      homeDir,
    });
    expect(prunedExport.prunedFileCount).toBe(1);
    await expect(fs.access(masterTarget)).rejects.toThrow();
    await expect(fs.readFile(localizedTarget, 'utf8')).resolves.toContain(
      'Merhaba'
    );
  }, 10000);

  it('does not refresh asset file metadata during a production export dry run', async () => {
    const setupPath = await writeProjectSetup(homeDir);
    const projectData = createProjectDataService();
    const created = await runCreateOrSkip(
      projectData.createFromSetup({
        setupPath,
        homeDir,
        idGenerator: createDeterministicIdGenerator(),
      })
    );
    if (!created) {
      return;
    }

    const narrationPath =
      'working-assets/base/sequences/01-logistics/scenes/01-foundry/clips/001/narration.wav';
    await fs.mkdir(path.dirname(path.join(created.projectPath, narrationPath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, narrationPath), 'audio bytes');

    const narration = await projectData.registerAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      type: 'narration',
      mediaKind: 'audio',
      title: 'Narration take 1',
      projectRelativePath: narrationPath as ProjectRelativePath,
      fileRole: 'primary',
      role: 'narration',
    });
    await projectData.createAssetSelect({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'clip', clipId: 'clip_test0001' },
      assetId: narration.assetId,
    });

    const beforeDryRun = readAssetFileMetadata(
      created.databasePath,
      narration.assetId
    );

    const dryRunExport = await projectData.exportProductionAssets({
      projectName: 'constantinople',
      homeDir,
      dryRun: true,
    });

    expect(dryRunExport.copiedFileCount).toBe(1);
    expect(readAssetFileMetadata(created.databasePath, narration.assetId)).toEqual(
      beforeDryRun
    );
    await expect(
      fs.access(
        path.join(
          created.projectPath,
          'production-assets',
          'master',
          'sequences',
          '01-the-young-sultan-s-obsession',
          'scenes',
          '01-a-throne-facing-an-ancient-city',
          'clips',
          '01-the-new-sultan',
          'narration.wav'
        )
      )
    ).rejects.toThrow();
  }, 10000);
});
