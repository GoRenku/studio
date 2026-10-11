import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AssetFileOwner, ProjectRelativePath } from '../../client/index.js';
import { createProjectDataService } from '../project-data-service.js';
import { createTestAssetFileFixture } from '../testing/asset-fixture-helpers.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('readImageEditTargets', () => {
  let homeDir: string;
  let projectFolder: string;
  const projectData = createProjectDataService();
  const owner: AssetFileOwner = { kind: 'castMember', id: 'cast_test0002' };

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-image-edit-targets-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      throw new Error('Expected a sample Project.');
    }
    projectFolder = created.projectPath;
  });

  async function image(type: string, name: string, mediaKind: 'image' | 'audio' = 'image') {
    const projectRelativePath = `tmp/${name}.png` as ProjectRelativePath;
    await fs.mkdir(path.join(projectFolder, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(projectFolder, projectRelativePath), 'image');
    return createTestAssetFileFixture({ projectName: 'constantinople', homeDir, owner, type, mediaKind, title: name, projectRelativePath });
  }

  it('numbers takes by creation order, keeps numbers after a discard, and reports selection and owner name', async () => {
    const first = await image('cast_profile', 'first');
    const second = await image('cast_profile', 'second');
    const third = await image('cast_profile', 'third');
    const sheet = await image('character_sheet', 'sheet');
    await projectData.selectAssetFile({ projectName: 'constantinople', homeDir, target: owner, assetFileId: third.id });
    await projectData.discardAssetFile({ projectName: 'constantinople', homeDir, owner, assetFileId: first.id });

    const targets = await projectData.readImageEditTargets({ projectName: 'constantinople', homeDir, assetFileIds: [third.id, second.id, sheet.id] });

    expect(targets.map((target) => [target.assetFile.id, target.takeNumber, target.selectable, target.selected, target.selectedAssetFileId])).toEqual([
      [third.id, 3, true, true, third.id],
      [second.id, 2, true, false, third.id],
      [sheet.id, 1, false, false, null],
    ]);
    expect(targets[0]).toMatchObject({ owner, ownerName: expect.any(String) });
    expect(targets[0]!.ownerName).not.toBe('');
  });

  it('collects every invalid candidate before failing', async () => {
    const valid = await image('cast_profile', 'valid');
    const discarded = await image('cast_profile', 'discarded');
    const audio = await image('cast_voice_sample', 'voice', 'audio');
    await projectData.discardAssetFile({ projectName: 'constantinople', homeDir, owner, assetFileId: discarded.id });

    await expect(projectData.readImageEditTargets({
      projectName: 'constantinople',
      homeDir,
      assetFileIds: [valid.id, valid.id, 'asset_file_missing', discarded.id, audio.id],
    })).rejects.toMatchObject({
      code: 'CORE_IMAGE_EDIT_TARGET_INVALID',
      issues: [
        expect.objectContaining({ location: expect.objectContaining({ path: ['assetFileIds', '1'] }) }),
        expect.objectContaining({ location: expect.objectContaining({ path: ['assetFileIds', '2'] }) }),
        expect.objectContaining({ location: expect.objectContaining({ path: ['assetFileIds', '3'] }) }),
        expect.objectContaining({ location: expect.objectContaining({ path: ['assetFileIds', '4'] }) }),
      ],
    });
  });

  async function edit(base: { id: string; projectRelativePath: string }, references = [base]) {
    const outputPath = `tmp/edit-${Math.random().toString(36).slice(2)}.png` as ProjectRelativePath;
    await fs.writeFile(path.join(projectFolder, outputPath), 'edit');
    const report = await projectData.attachGenerationMedia({
      projectName: 'constantinople', homeDir, purpose: 'image.edit',
      target: { kind: 'assetFile', assetFileId: base.id },
      sourceProjectRelativePath: outputPath,
      generationProvenance: {
        provider: 'fal-ai', model: 'blackforestlabs/flux-3/edit-image', mediaKind: 'image', prompt: 'Edit',
        request: { prompt: 'Edit', image_urls: references.map((reference) => ({ $file: reference.projectRelativePath, mimeType: 'image/png', reviewLabel: 'Reference' })) },
      },
    });
    return report.assetFile;
  }

  it('reads the source and every edit made from it, through chained edits, with each parent', async () => {
    const source = await image('cast_profile', 'source');
    const unrelated = await image('cast_profile', 'unrelated');
    const first = await edit(source);
    const second = await edit(first);
    const branch = await edit(source);

    const lineage = await projectData.readImageEditLineage({ projectName: 'constantinople', homeDir, sourceAssetFileId: source.id });

    expect(lineage.map((entry) => [entry.target.assetFile.id, entry.parentAssetFileId])).toEqual([
      [source.id, null],
      [first.id, source.id],
      [second.id, first.id],
      [branch.id, source.id],
    ]);
    expect(lineage.map((entry) => entry.target.assetFile.id)).not.toContain(unrelated.id);
    expect(lineage.at(-1)!.target.selected).toBe(true);
  });

  it('keeps later edits linked through a deleted version but does not return it', async () => {
    const source = await image('cast_profile', 'source');
    const first = await edit(source);
    const second = await edit(first);
    await projectData.discardAssetFile({ projectName: 'constantinople', homeDir, owner, assetFileId: first.id });

    const lineage = await projectData.readImageEditLineage({ projectName: 'constantinople', homeDir, sourceAssetFileId: source.id });

    expect(lineage.map((entry) => [entry.target.assetFile.id, entry.parentAssetFileId])).toEqual([
      [source.id, null],
      [second.id, first.id],
    ]);
  });

  it('uses the explicit edit target when the request also references an ancestor or another sibling', async () => {
    const source = await image('cast_profile', 'source');
    const first = await edit(source);
    const second = await edit(first, [first, source]);
    const branch = await edit(first, [source, first]);
    const unrelated = await image('cast_profile', 'unrelated');
    const outside = await edit(unrelated, [source, unrelated]);

    const lineage = await projectData.readImageEditLineage({ projectName: 'constantinople', homeDir, sourceAssetFileId: source.id });

    expect(lineage.map((entry) => [entry.target.assetFile.id, entry.parentAssetFileId])).toEqual([
      [source.id, null],
      [first.id, source.id],
      [second.id, first.id],
      [branch.id, first.id],
    ]);
    expect((await projectData.readImageEditLineage({ projectName: 'constantinople', homeDir, sourceAssetFileId: unrelated.id }))
      .map((entry) => [entry.target.assetFile.id, entry.parentAssetFileId])).toEqual([
      [unrelated.id, null],
      [outside.id, unrelated.id],
    ]);
  });

  it('does not treat an image creation as an edit just because its request references the source', async () => {
    const source = await image('cast_profile', 'source');
    const output = await image('cast_profile', 'output');
    await projectData.attachGenerationMedia({
      projectName: 'constantinople', homeDir, purpose: 'cast.profile', target: owner,
      sourceProjectRelativePath: output.projectRelativePath,
      generationProvenance: {
        provider: 'fal-ai', model: 'image', mediaKind: 'image', prompt: 'Create',
        request: { image_urls: [{ $file: source.projectRelativePath, mimeType: 'image/png', reviewLabel: 'Reference' }] },
      },
    });

    expect((await projectData.readImageEditLineage({ projectName: 'constantinople', homeDir, sourceAssetFileId: source.id }))
      .map((entry) => entry.target.assetFile.id)).toEqual([source.id]);
  });
});
