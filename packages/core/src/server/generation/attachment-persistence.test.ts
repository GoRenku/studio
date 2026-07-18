import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { GenerationRun, GenerationSpec } from '../../client/index.js';
import { readAssetFileGenerationRecord } from '../database/access/asset-file-generations.js';
import { readAssetRelationship } from '../database/access/asset-relationships/index.js';
import { readAssetRecord } from '../database/access/assets.js';
import { readLookbookImageRecord } from '../database/access/lookbook-images.js';
import {
  insertLookbookRecord,
  readLookbookRecordByKind,
} from '../database/access/lookbook.js';
import {
  insertGenerationRunRecord,
  insertGenerationSpecRecord,
} from '../database/access/media-generation.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import type { EntityIdPrefix, ProjectIdGenerator } from '../entity-ids.js';
import { createProjectDataService } from '../project-data-service.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import {
  castCharacterSheetAttachmentDestination,
  castProfileAttachmentDestination,
  lookbookImageAttachmentDestination,
} from './attachment-destinations.js';
import { persistGeneratedMediaAttachment } from './attachment-persistence.js';

describe('generated media attachment persistence', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-persistence-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('persists one complete attachment and rolls back database rows and copied files on failure', async () => {
    const created = await createSampleMovieProject({
      projectData: createProjectDataService(),
      homeDir,
    });
    if (!created) {
      return;
    }
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'source.png'), 'image');
    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });

    try {
      const persisted = persistGeneratedMediaAttachment({
        session,
        projectFolder: created.projectPath,
        idGenerator: fixedIdGenerator('success'),
        now: '2026-07-17T10:00:00.000Z',
        sourceProjectRelativePath: 'tmp/source.png',
        destination: castProfileAttachmentDestination('cast_test0001', 'Profile'),
        asset: {
          type: 'profile',
          mediaKind: 'image',
          title: 'Profile',
          origin: 'external',
        },
        fileRole: 'primary',
        relationshipRole: 'profile',
      });
      expect(persisted).toEqual({
        assetId: 'asset_success',
        assetFileId: 'asset_file_success',
        relationshipId: 'cast_asset_success',
      });
      expect(
        readAssetRelationship(session, {
          target: { kind: 'castMember', castMemberId: 'cast_test0001' },
          assetId: persisted.assetId,
        })
      ).toMatchObject({
        title: 'Profile',
        role: 'profile',
        files: [{ id: 'asset_file_success', role: 'primary' }],
      });

      const lookbookId = ensureProductionLookbook(session);
      const run = insertSuccessfulGenerationRun(
        session,
        lookbookId,
        sourceContentHash('image')
      );
      const lookbookAttachment = persistGeneratedMediaAttachment({
        session,
        projectFolder: created.projectPath,
        idGenerator: fixedIdGenerator('lookbook'),
        now: '2026-07-17T10:00:30.000Z',
        sourceProjectRelativePath: 'tmp/source.png',
        destination: lookbookImageAttachmentDestination(
          lookbookId,
          'Lookbook Image'
        ),
        asset: {
          type: 'lookbook-image',
          mediaKind: 'image',
          title: 'Lookbook Image',
          origin: 'generated',
        },
        fileRole: 'primary',
        relationshipRole: 'lookbook-image',
        provenanceReceipt: { run },
      });
      expect(lookbookAttachment.ownerRecord).toEqual({
        kind: 'lookbookImage',
        id: 'lookbook_image_lookbook',
      });
      expect(
        readLookbookImageRecord(session, 'lookbook_image_lookbook')
      ).toMatchObject({
        lookbookId,
        assetId: 'asset_lookbook',
      });
      expect(
        readAssetFileGenerationRecord(session, 'asset_file_lookbook')
      ).toMatchObject({
        mediaGenerationRunId: run.id,
        outputArtifactId: 'artifact_image',
      });

      const filesBeforeFailure = await listFiles(created.projectPath);
      expect(() =>
        persistGeneratedMediaAttachment({
          session,
          projectFolder: created.projectPath,
          idGenerator: {
            next(prefix) {
              return prefix === 'cast_asset'
                ? 'cast_asset_success'
                : `${prefix}_rollback`;
            },
          },
          now: '2026-07-17T10:01:00.000Z',
          sourceProjectRelativePath: 'tmp/source.png',
          destination: castCharacterSheetAttachmentDestination(
            'cast_test0002',
            'Rollback'
          ),
          asset: {
            type: 'character_sheet',
            mediaKind: 'image',
            title: 'Rollback',
            origin: 'generated',
          },
          fileRole: 'primary',
          relationshipRole: 'character-sheet',
        })
      ).toThrow();
      expect(readAssetRecord(session, 'asset_rollback')).toBeNull();
      expect(await listFiles(created.projectPath)).toEqual(filesBeforeFailure);
    } finally {
      session.close();
    }
  });
});

function fixedIdGenerator(suffix: string): ProjectIdGenerator {
  return {
    next(prefix: EntityIdPrefix) {
      return `${prefix}_${suffix}`;
    },
  };
}

function ensureProductionLookbook(
  session: Parameters<typeof readLookbookRecordByKind>[0]
): string {
  const existing = readLookbookRecordByKind(session, 'production');
  if (existing) {
    return existing.id;
  }
  const id = 'lookbook_production_persistence';
  insertLookbookRecord(session, {
    id,
    name: 'Production Lookbook',
    kind: 'production',
    definitionJson: '{}',
    now: '2026-07-17T09:59:00.000Z',
  });
  return id;
}

function insertSuccessfulGenerationRun(
  session: Parameters<typeof insertGenerationRunRecord>[0],
  lookbookId: string,
  contentHash: string
): GenerationRun {
  const spec: GenerationSpec = {
    executionKind: 'renku-managed',
    purpose: 'lookbook.image',
    target: { kind: 'lookbook', id: lookbookId },
    model: { provider: 'test', model: 'test-image' },
    values: {},
    references: [],
  };
  insertGenerationSpecRecord(session, {
    id: 'media_generation_spec_persistence',
    spec,
    createdAt: '2026-07-17T09:59:30.000Z',
    updatedAt: '2026-07-17T09:59:30.000Z',
  });
  return insertGenerationRunRecord(session, {
    id: 'media_generation_run_persistence',
    specId: 'media_generation_spec_persistence',
    specSnapshot: spec,
    provider: 'test',
    model: 'test-image',
    providerPayload: {},
    estimate: {
      provider: 'test',
      model: 'test-image',
      estimatedCostUsd: 0,
      approvalToken: 'sha256:test',
      billableUnits: {},
    },
    status: 'completed',
    outputs: [
      {
        artifactId: 'artifact_image',
        mimeType: 'image/png',
        contentHash,
      },
    ],
    receipt: null,
    diagnostics: [],
    startedAt: '2026-07-17T09:59:30.000Z',
    completedAt: '2026-07-17T09:59:31.000Z',
  });
}

function sourceContentHash(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

async function listFiles(folder: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else {
        files.push(path.relative(folder, absolutePath));
      }
    }
  }
  await visit(folder);
  return files.sort();
}
