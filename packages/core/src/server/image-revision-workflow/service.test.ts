import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectRelativePath } from '../../client/index.js';
import { createProjectDataService } from '../project-data-service.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import { readImageRevisionContext } from './service.js';

describe('image revision workflow', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-image-revision-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('shows the source image in the initial Edit preview', async () => {
    const created = await createSampleMovieProject({
      projectData: createProjectDataService(),
      homeDir,
    });
    if (!created) {
      return;
    }
    const projectRelativePath =
      'cast/urban/character-sheets/urban-character-sheet.png' as ProjectRelativePath;
    const absolutePath = path.join(created.projectPath, projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, 'image bytes');
    const asset = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', castMemberId: 'cast_test0001' },
      type: 'cast_character_sheet',
      mediaKind: 'image',
      title: 'Urban Character Sheet',
      projectRelativePath,
      fileRole: 'primary',
      role: 'character-sheet',
    });

    const context = await readImageRevisionContext({
      projectName: 'constantinople',
      homeDir,
      target: {
        kind: 'castCharacterSheet',
        castMemberId: 'cast_test0001',
        assetId: asset.assetId,
        assetFileId: asset.files[0]!.id,
      },
    });

    expect(context.edit).toMatchObject({
      state: 'available',
      preview: {
        references: [
          expect.objectContaining({
            assetId: asset.assetId,
            assetFileId: asset.files[0]!.id,
            selected: true,
          }),
        ],
      },
    });
  });
});
