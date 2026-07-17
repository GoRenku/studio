import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { insertLookbookRecord, readLookbookRecordByKind } from '../database/access/lookbook.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { createProjectDataService } from '../project-data-service.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('generation media attachment', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-attachment-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('returns the exact current owner surface for every normal attachment purpose', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const lookbooks = await ensureLookbooks(homeDir);
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'attachment.png'), 'image');

    const cases = [
      {
        purpose: 'lookbook.image' as const,
        target: { kind: 'lookbook' as const, id: lookbooks.production },
        resourceKey: `surface:visual-language:lookbook:${lookbooks.production}`,
      },
      {
        purpose: 'lookbook.video-sheet' as const,
        target: { kind: 'lookbook' as const, id: lookbooks.production },
        resourceKey: `surface:visual-language:lookbook:${lookbooks.production}`,
      },
      {
        purpose: 'lookbook.storyboard-sheet' as const,
        target: { kind: 'lookbook' as const, id: lookbooks.storyboard },
        resourceKey: `surface:visual-language:lookbook:${lookbooks.storyboard}`,
      },
      {
        purpose: 'cast.character-sheet' as const,
        target: { kind: 'castMember' as const, id: 'cast_test0001' },
        resourceKey: 'surface:castMember:cast_test0001',
      },
      {
        purpose: 'cast.profile' as const,
        target: { kind: 'castMember' as const, id: 'cast_test0001' },
        resourceKey: 'surface:castMember:cast_test0001',
      },
      {
        purpose: 'location.sheet' as const,
        target: { kind: 'location' as const, id: 'location_test0001' },
        resourceKey: 'surface:location:location_test0001',
      },
      {
        purpose: 'location.hero' as const,
        target: { kind: 'location' as const, id: 'location_test0001' },
        resourceKey: 'surface:location:location_test0001',
      },
    ];

    for (const attachment of cases) {
      const report = await projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: attachment.purpose,
        target: attachment.target,
        sourceProjectRelativePath: 'tmp/attachment.png',
      });
      expect(report.resourceKeys).toEqual([attachment.resourceKey]);
      expect(report.project).toMatchObject({
        id: expect.any(String),
        name: 'constantinople',
        projectFolder: created.projectPath,
      });
    }
  });
});

async function ensureLookbooks(homeDir: string): Promise<{
  production: string;
  storyboard: string;
}> {
  const { session } = await openProjectSession({
    projectName: 'constantinople',
    homeDir,
  });
  try {
    const now = new Date().toISOString();
    const production = readLookbookRecordByKind(session, 'production')?.id ?? 'lookbook_production_test';
    const storyboard = readLookbookRecordByKind(session, 'storyboard')?.id ?? 'lookbook_storyboard_test';
    if (!readLookbookRecordByKind(session, 'production')) {
      insertLookbookRecord(session, {
        id: production,
        name: 'Production Lookbook',
        kind: 'production',
        definitionJson: '{}',
        now,
      });
    }
    if (!readLookbookRecordByKind(session, 'storyboard')) {
      insertLookbookRecord(session, {
        id: storyboard,
        name: 'Storyboard Lookbook',
        kind: 'storyboard',
        definitionJson: '{}',
        now,
      });
    }
    return { production, storyboard };
  } finally {
    session.close();
  }
}
