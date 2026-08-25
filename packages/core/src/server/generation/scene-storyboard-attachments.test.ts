import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneBeatsInput } from '../../client/scene-beats/index.js';
import { createDeterministicIdGenerator } from '../entity-ids.js';
import { createProjectDataService } from '../project-data-service.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('Scene storyboard attachment', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-storyboard-provenance-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('persists exact provenance independently for every grouped Beat image', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const screenplay = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const scene = screenplay.screenplay.scenes[0];
    if (!scene?.blocks[0]) {
      throw new Error('Expected a Scene fixture.');
    }
    const revision = await projectData.createSceneBeatsRevision({
      homeDir,
      document: revisionDocument(scene.id, scene.blocks[0].id),
      idGenerator: createDeterministicIdGenerator(),
    });
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'beat.png'), 'image');
    const provenance = {
      provider: 'fal-ai',
      model: 'openai/gpt-image-2/edit',
      mediaKind: 'image' as const,
      prompt: 'One exact storyboard panel.',
      request: {
        prompt: 'One exact storyboard panel.',
        image_urls: [{ $file: 'lookbooks/storyboard/sheet.png', mimeType: 'image/png' }],
      },
      receipt: { requestId: 'fal_storyboard_1' },
    };

    const report = await projectData.attachSceneStoryboardImages({
      homeDir,
      sceneId: scene.id,
      sceneBeatsRevisionId: revision.activeRevisionId,
      document: {
        sceneBeatsRevisionId: revision.activeRevisionId,
        select: true,
        beats: [{
          beatId: 'beat_test0001',
          source: 'tmp/beat.png',
          generationProvenance: provenance,
        }],
      },
    });

    expect(report.imported).toHaveLength(1);
    expect(report.imported[0]?.generationProvenance).toEqual(provenance);
    expect(report.imported[0]?.origin).toBe('generated');
  });
});

function revisionDocument(sceneId: string, blockId: string): SceneBeatsInput {
  return {
    sceneId,
    beats: [{
      title: 'Decision',
      description: 'The decision lands in a held frame.',
      narrativeDevelopment: 'The scene reaches its visual decision.',
      narrativePurpose: 'Establish the decisive moment.',
      screenplayBlockIds: [blockId],
      castMemberIds: [],
      locationIds: [],
      propIds: [],
    }],
  };
}
