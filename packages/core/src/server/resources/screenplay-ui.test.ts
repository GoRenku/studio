import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  createProjectDataService,
  type ProjectRelativePath,
} from '../index.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('screenplay UI resources', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'renku-screenplay-ui-resource-test-')
    );
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('projects selected Cast profile and Location hero images for Scene mentions', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      throw new Error('Expected sample movie project.');
    }
    const screenplay = await projectData.readScreenplay({
      homeDir,
    });
    const castMemberId = screenplay.screenplay?.cast[0]?.id;
    const locationId = screenplay.screenplay?.locations[0]?.id;
    const sceneId = screenplay.screenplay?.acts[0]?.sequences[0]?.scenes[0]?.id;
    if (!castMemberId || !locationId || !sceneId) {
      throw new Error('Expected sample Cast Member, Location, and Scene ids.');
    }

    const castPath = 'cast/profile.png' as ProjectRelativePath;
    const locationPath = 'locations/hero.png' as ProjectRelativePath;
    await fs.mkdir(path.join(created.projectPath, 'cast'), { recursive: true });
    await fs.mkdir(path.join(created.projectPath, 'locations'), {
      recursive: true,
    });
    await fs.writeFile(path.join(created.projectPath, castPath), 'cast image');
    await fs.writeFile(
      path.join(created.projectPath, locationPath),
      'location image'
    );
    const castProfile = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'castMember', id: castMemberId },
      type: 'cast_profile',
      mediaKind: 'image',
      title: 'Urban profile',
      projectRelativePath: castPath,
      fileRole: 'primary',
    });
    const locationHero = await createTestAssetFixture({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'location', id: locationId },
      type: 'location_hero',
      mediaKind: 'image',
      title: 'City walls hero',
      projectRelativePath: locationPath,
      fileRole: 'primary',
    });
    await projectData.selectAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'castMember', id: castMemberId },
      assetId: castProfile.id,
    });
    await projectData.selectAsset({
      projectName: 'constantinople',
      homeDir,
      target: { kind: 'location', id: locationId },
      assetId: locationHero.id,
    });

    const resource = await projectData.readSceneNarrativeResource({
      projectName: 'constantinople',
      homeDir,
      sceneId,
    });

    expect(resource.castMemberImages[castMemberId]).toMatchObject({
      assetId: castProfile.id,
      title: 'Urban profile',
    });
    expect(resource.locationImages[locationId]).toMatchObject({
      assetId: locationHero.id,
      title: 'City walls hero',
    });
  });
});
