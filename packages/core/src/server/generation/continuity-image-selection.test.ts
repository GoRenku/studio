import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createDeterministicIdGenerator } from '../entity-ids.js';
import { createProjectDataService } from '../project-data-service.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('continuity image attachment selection', () => {
  const projectData = createProjectDataService();
  let project: { projectName: string; homeDir: string };

  beforeEach(async () => {
    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-continuity-selection-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      throw new Error('Expected a sample Project.');
    }
    project = { projectName: 'constantinople', homeDir };
    await projectData.applyPropOperations({
      homeDir,
      idGenerator: createDeterministicIdGenerator(),
      document: {
        kind: 'propOperations',
        operations: [{
          operation: 'prop.add',
          prop: { key: 'bronze-seal', handle: 'bronze-seal', name: 'Bronze seal' },
        }],
      },
    });
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'image.png'), 'image');
  });

  const subjects = [
    {
      purpose: 'cast.profile',
      sheetPurpose: 'cast.character-sheet',
      owner: { kind: 'castMember', id: 'cast_test0002' },
      readResource: () => projectData.readCastMemberResource({ ...project, castMemberId: 'cast_test0002' }),
      readOverview: async () => (await projectData.readCastOverviewResource(project)).cast.items,
    },
    {
      purpose: 'location.hero',
      sheetPurpose: 'location.sheet',
      owner: { kind: 'location', id: 'location_test0001' },
      readResource: () => projectData.readLocationResource({ ...project, locationId: 'location_test0001' }),
      readOverview: async () => (await projectData.readLocationOverviewResource(project)).locations.items,
    },
    {
      purpose: 'prop.hero',
      sheetPurpose: 'prop.sheet',
      owner: { kind: 'prop', id: 'prop_test0001' },
      readResource: () => projectData.readPropResource({ ...project, propId: 'prop_test0001' }),
      readOverview: async () => (await projectData.readPropOverviewResource(project)).props.items,
    },
  ] as const;

  describe.each(subjects)('$purpose', (subject) => {
    const attach = (select?: boolean, generated = false) => projectData.attachGenerationMedia({
      ...project,
      purpose: subject.purpose,
      target: subject.owner,
      sourceProjectRelativePath: 'tmp/image.png',
      select,
      ...(generated ? {
        generationProvenance: {
          provider: 'codex',
          model: 'gpt-image-2',
          mediaKind: 'image' as const,
          prompt: 'A continuity image',
          request: { prompt: 'A continuity image' },
        },
      } : {}),
    });

    it.each([false, true])('selects the first image for details and overview (generated: %s)', async (generated) => {
      await projectData.attachGenerationMedia({
        ...project,
        purpose: subject.sheetPurpose,
        target: subject.owner,
        sourceProjectRelativePath: 'tmp/image.png',
      });
      expect((await projectData.listAssetFilePage({ ...project, owner: subject.owner })).selectedAssetFileId)
        .toBeNull();

      const attached = await attach(undefined, generated);
      expect((await projectData.listAssetFilePage({ ...project, owner: subject.owner })).selectedAssetFileId)
        .toBe(attached.assetFile.id);
      expect((await subject.readResource()).firstImage?.assetFileId).toBe(attached.assetFile.id);
      expect((await subject.readOverview()).find((entry) => entry.id === subject.owner.id)?.firstImage?.assetFileId)
        .toBe(attached.assetFile.id);
      expect(attached.resourceKeys).toContain(`surface:${subject.owner.kind}:${subject.owner.id}`);
    });

    it('preserves an existing selection and allows an explicit replacement', async () => {
      const first = await attach();
      await attach();
      expect((await subject.readResource()).firstImage?.assetFileId).toBe(first.assetFile.id);

      const chosen = await attach(true);
      await attach();
      expect((await subject.readResource()).firstImage?.assetFileId).toBe(chosen.assetFile.id);
    });

    it('preserves a cleared selection when another candidate is attached', async () => {
      await attach();
      await projectData.clearAssetFileSelection({ ...project, target: subject.owner });
      await attach();
      expect((await projectData.listAssetFilePage({ ...project, owner: subject.owner })).selectedAssetFileId)
        .toBeNull();
      expect((await subject.readResource()).firstImage).toBeUndefined();
    });

    it('selects a new sole candidate when the previous image is in Trash', async () => {
      const first = await attach();
      await projectData.discardAssetFile({ ...project, owner: subject.owner, assetFileId: first.assetFile.id });
      const replacement = await attach();
      expect((await subject.readResource()).firstImage?.assetFileId).toBe(replacement.assetFile.id);
    });
  });

  it('does not apply continuity defaults to a Project Cover', async () => {
    await projectData.attachGenerationMedia({
      ...project,
      purpose: 'project.cover',
      target: { kind: 'project', id: 'project' },
      sourceProjectRelativePath: 'tmp/image.png',
    });
    expect((await projectData.listAssetFilePage({ ...project, owner: { kind: 'project' }, type: 'project_cover' })).selectedAssetFileId)
      .toBeNull();
  });
});
