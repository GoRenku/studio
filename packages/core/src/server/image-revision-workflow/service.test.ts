import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GenerationRun, ProjectRelativePath } from '../../client/index.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { createDeterministicIdGenerator } from '../entity-ids.js';
import { createProjectDataService } from '../project-data-service.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import { attachImageRevisionOutput } from './attachment.js';
import { createImageRevisionModeDefinition } from './draft.js';
import { readImageRevisionContext } from './service.js';
import { resolveImageRevisionSource } from './source.js';

const persistGeneratedMediaAttachment = vi.hoisted(() =>
  vi.fn(() => ({
    assetId: 'asset_revision',
    assetFileId: 'asset_file_revision',
    relationshipId: 'cast_asset_revision',
  }))
);

vi.mock('../generation/attachment-persistence.js', () => ({
  persistGeneratedMediaAttachment,
}));

describe('image revision workflow', () => {
  let homeDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
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

    expect(context.edit.state).toBe('available');
    if (context.edit.state !== 'available') {
      return;
    }
    expect(context.edit.preview.references.slots).toEqual([
      expect.objectContaining({
        label: 'Source Image',
        locked: true,
        current: expect.objectContaining({
          assetId: asset.assetId,
          assetFileId: asset.files[0]!.id,
          selected: true,
        }),
        eligibleCandidates: [
          expect.objectContaining({
            assetId: asset.assetId,
            assetFileId: asset.files[0]!.id,
          }),
        ],
      }),
    ]);
    expect(context.edit.preview.references.additional).toEqual([]);
    expect(context.regenerate).toEqual(expect.objectContaining({
      state: 'unavailable',
      diagnostics: [
        expect.objectContaining({
          message:
            'Regenerate is unavailable because this image was imported and has no original generation request.',
        }),
      ],
    }));
  });

  it('preserves source metadata and role while using the current owner surface', async () => {
    const created = await createSampleMovieProject({
      projectData: createProjectDataService(),
      homeDir,
    });
    if (!created) {
      return;
    }
    const projectRelativePath =
      'cast/urban/character-sheets/source.png' as ProjectRelativePath;
    const absolutePath = path.join(created.projectPath, projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, 'source image');
    const asset = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', castMemberId: 'cast_test0001' },
      type: 'cast_character_sheet',
      mediaKind: 'image',
      title: 'Urban Character Sheet',
      oneLineSummary: 'Preserved summary',
      projectRelativePath,
      fileRole: 'character-sheet',
      role: 'character-sheet',
    });
    const target = {
      kind: 'castCharacterSheet' as const,
      castMemberId: 'cast_test0001',
      assetId: asset.assetId,
      assetFileId: asset.files[0]!.id,
    };
    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      const report = attachImageRevisionOutput({
        session,
        projectFolder: created.projectPath,
        target,
        source: resolveImageRevisionSource(session, target),
        run: { id: 'media_generation_run_revision' } as GenerationRun,
        sourceProjectRelativePath: 'tmp/revised.png',
        idGenerator: createDeterministicIdGenerator(),
        now: '2026-07-17T12:00:00.000Z',
      });

      expect(report).toEqual({
        imported: {
          assetId: 'asset_revision',
          assetFileId: 'asset_file_revision',
        },
        resourceKeys: ['surface:castMember:cast_test0001'],
      });
      expect(persistGeneratedMediaAttachment).toHaveBeenCalledWith(
        expect.objectContaining({
          asset: {
            type: 'cast_character_sheet',
            mediaKind: 'image',
            title: 'Urban Character Sheet',
            oneLineSummary: 'Preserved summary',
            origin: 'generated',
          },
          fileRole: 'character-sheet',
          relationshipRole: 'character-sheet',
          destination: expect.objectContaining({
            target: {
              kind: 'castMember',
              castMemberId: 'cast_test0001',
            },
            resourceKeys: ['surface:castMember:cast_test0001'],
          }),
        })
      );
    } finally {
      session.close();
    }
  });

  it('preserves image.edit purpose and target when regenerating its source request', async () => {
    const created = await createSampleMovieProject({
      projectData: createProjectDataService(),
      homeDir,
    });
    if (!created) {
      return;
    }
    const projectRelativePath =
      'cast/urban/character-sheets/edited-source.png' as ProjectRelativePath;
    const absolutePath = path.join(created.projectPath, projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, 'edited source image');
    const asset = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', castMemberId: 'cast_test0001' },
      type: 'cast_character_sheet',
      mediaKind: 'image',
      title: 'Edited Urban Character Sheet',
      projectRelativePath,
      fileRole: 'character-sheet',
      role: 'character-sheet',
    });
    const target = {
      kind: 'castCharacterSheet' as const,
      castMemberId: 'cast_test0001',
      assetId: asset.assetId,
      assetFileId: asset.files[0]!.id,
    };
    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      const source = resolveImageRevisionSource(session, target);
      const definition = await createImageRevisionModeDefinition({
        mode: 'regenerate',
        source: {
          ...source,
          sourceGenerationSpec: {
            executionKind: 'agent-external',
            purpose: 'image.edit',
            target: { kind: 'asset', id: asset.assetId },
            model: { provider: 'codex', model: 'gpt-image-2' },
            values: { prompt: 'Preserve this exact edit request.' },
            references: [{
              placement: {
                kind: 'slot',
                sectionId: 'source',
                slotId: 'source-image',
              },
              reference: {
                kind: 'asset-file',
                assetId: asset.assetId,
                assetFileId: asset.files[0]!.id,
              },
            }],
          },
        },
        session,
        projectFolder: created.projectPath,
      });

      expect(definition.spec).toMatchObject({
        executionKind: 'renku-managed',
        purpose: 'image.edit',
        target: { kind: 'asset', id: asset.assetId },
      });
      expect(definition.preview).toMatchObject({
        purpose: 'image.edit',
        target: { kind: 'asset', id: asset.assetId },
        finalPrompt: { authoredText: 'Preserve this exact edit request.' },
      });
    } finally {
      session.close();
    }
  });
});
