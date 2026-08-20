import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneBeatsInput } from '../../client/scene-beats/index.js';
import { createDeterministicIdGenerator } from '../entity-ids.js';
import { createProjectDataService } from '../project-data-service.js';
import {
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('Scene storyboard attachment', () => {
  let homeDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-storyboard-attachment-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
  });

  it('persists ordinary Beat candidates and changes selection only when requested', async () => {
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
    const sceneReferences = screenplay.screenplay.references.filter((reference) =>
      scene && 'sceneId' in reference.target && reference.target.sceneId === scene.id
    );
    const castMemberId = sceneReferences.find(
      (reference) => reference.subject.type === 'castMember'
    )?.subject.id;
    const locationId = sceneReferences.find(
      (reference) => reference.subject.type === 'location'
    )?.subject.id;
    expect(scene?.id && castMemberId && locationId).toBeTruthy();
    const revision = await projectData.createSceneBeatsRevision({
      homeDir,
      document: revisionDocument(scene!.id, scene!.blocks[0]!.id, castMemberId!, locationId!),
      idGenerator: createDeterministicIdGenerator(),
    });
    const beatId = 'beat_test0001';
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'beat.png'), 'image');

    const report = await projectData.attachSceneStoryboardImages({
      homeDir,
      sceneId: scene!.id!,
      sceneBeatsRevisionId: revision.activeRevisionId,
      document: {
        sceneBeatsRevisionId: revision.activeRevisionId,
        select: true,
        beats: [{ beatId, source: 'tmp/beat.png' }],
      },
    });
    expect(report.resourceKeys).toEqual([
      `surface:scene:${scene!.id}:beats`,
    ]);
    expect(report.imported).toHaveLength(1);
    expect(report.files).toEqual([
      expect.objectContaining({
        beatId,
        projectRelativePath: 'storyboards/1/00-iteration/beat.png',
      }),
    ]);
    await expect(fs.access(path.join(
      created.projectPath,
      report.files[0]!.projectRelativePath
    ))).resolves.toBeUndefined();

    const shotPlan = await projectData.createShotPlan({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene!.id!,
      title: 'Revision-bound coverage',
      coverage: {
        sceneBeatsRevisionId: revision.activeRevisionId,
        beatIds: [beatId],
      },
      shots: [],
    });

    const initiallySelected = await projectData.readSceneStoryboardStatus({
      homeDir,
      sceneId: scene!.id!,
      sceneBeatsRevisionId: revision.activeRevisionId,
    });
    expect(initiallySelected.beats[0]).toMatchObject({
      beatId,
      selectedImageId: report.imported[0]!.id,
      images: [expect.objectContaining({
        id: report.imported[0]!.id,
        owner: {
          kind: 'sceneBeat',
          sceneId: scene!.id!,
          beatId,
        },
      })],
    });

    await fs.writeFile(
      path.join(created.projectPath, 'tmp', 'beat-candidate.png'),
      'second image'
    );
    const unselected = await projectData.attachSceneStoryboardImages({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene!.id!,
      sceneBeatsRevisionId: revision.activeRevisionId,
      document: {
        sceneBeatsRevisionId: revision.activeRevisionId,
        select: false,
        beats: [{
          beatId,
          source: 'tmp/beat-candidate.png',
        }],
      },
    });
    const afterUnselectedImport =
      await projectData.readSceneStoryboardStatus({
        homeDir,
        sceneId: scene!.id!,
        sceneBeatsRevisionId: revision.activeRevisionId,
      });
    expect(afterUnselectedImport.beats[0]!.images).toHaveLength(2);
    expect(afterUnselectedImport.beats[0]!.selectedImageId).toBe(
      report.imported[0]!.id
    );

    await projectData.selectAsset({
      projectName: 'constantinople',
      homeDir,
      target: {
        kind: 'sceneBeat',
        sceneId: scene!.id!,
        beatId,
      },
      assetId: unselected.imported[0]!.id,
    });
    const afterExplicitSelection =
      await projectData.readSceneStoryboardStatus({
        homeDir,
        sceneId: scene!.id!,
        sceneBeatsRevisionId: revision.activeRevisionId,
      });
    expect(afterExplicitSelection.beats[0]!.selectedImageId).toBe(
      unselected.imported[0]!.id
    );

    const sourceAsset = report.imported[0]!;
    const sourceFile = sourceAsset.files[0]!;
    const editSpec = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        executionKind: 'agent-external',
        purpose: 'image.edit',
        target: { kind: 'asset', id: sourceAsset.id },
        model: { provider: 'codex', model: 'gpt-image-2' },
        values: { prompt: 'Preserve the source and repair the wall.' },
        references: [{
          placement: {
            kind: 'slot',
            sectionId: 'source',
            slotId: 'source-image',
          },
          reference: {
            kind: 'asset-file',
            assetId: sourceAsset.id,
            assetFileId: sourceFile.id,
          },
        }],
      },
    });
    await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: editSpec.id,
    });
    await fs.writeFile(
      path.join(created.projectPath, 'tmp', 'beat-edited.png'),
      'edited image'
    );
    const edited = await projectData.attachSceneStoryboardImages({
      projectName: 'constantinople',
      homeDir,
      sceneId: scene!.id!,
      sceneBeatsRevisionId: revision.activeRevisionId,
      document: {
        sceneBeatsRevisionId: revision.activeRevisionId,
        select: true,
        beats: [{
          beatId,
          source: 'tmp/beat-edited.png',
          sourceSpecId: editSpec.id,
        }],
      },
    });
    const afterEdit = await projectData.readSceneStoryboardStatus({
      homeDir,
      sceneId: scene!.id!,
      sceneBeatsRevisionId: revision.activeRevisionId,
    });
    expect(afterEdit.beats[0]!.selectedImageId).toBe(edited.imported[0]!.id);

    const reset = await projectData.resetSceneBeats({
      homeDir,
      document: revisionDocument(
        scene!.id,
        scene!.blocks[0]!.id,
        castMemberId!,
        locationId!
      ),
      idGenerator: createDeterministicIdGenerator(),
    });
    const resetRead = await projectData.readSceneBeatsRevision({
      homeDir,
      revisionId: reset.revision.id,
    });
    const resetBeatId = resetRead.sceneBeats!.beats[0]!.id;
    expect(resetBeatId).not.toBe(beatId);
    await expect(projectData.readSceneStoryboardStatus({
      homeDir,
      sceneId: scene!.id,
      sceneBeatsRevisionId: revision.activeRevisionId,
    })).resolves.toMatchObject({
      beats: [expect.objectContaining({
        beatId,
        selectedImageId: edited.imported[0]!.id,
      })],
    });
    await expect(projectData.readSceneStoryboardStatus({
      homeDir,
      sceneId: scene!.id,
      sceneBeatsRevisionId: reset.revision.id,
    })).resolves.toMatchObject({
      beats: [expect.objectContaining({
        beatId: resetBeatId,
        selectedImageId: null,
        needsStoryboardImage: true,
      })],
    });

    await projectData.setActiveSceneBeatsRevision({
      homeDir,
      sceneId: scene!.id,
      revisionId: revision.activeRevisionId,
    });
    await expect(projectData.readSceneStoryboardStatus({
      homeDir,
      sceneId: scene!.id,
      sceneBeatsRevisionId: revision.activeRevisionId,
    })).resolves.toMatchObject({
      beats: [expect.objectContaining({
        beatId,
        selectedImageId: edited.imported[0]!.id,
      })],
    });

    await projectData.setActiveSceneBeatsRevision({
      homeDir,
      sceneId: scene!.id,
      revisionId: reset.revision.id,
    });
    await expect(projectData.readSceneStoryboardStatus({
      homeDir,
      sceneId: scene!.id,
      sceneBeatsRevisionId: reset.revision.id,
    })).resolves.toMatchObject({
      beats: [expect.objectContaining({ beatId: resetBeatId })],
    });
    await expect(projectData.readShotPlan({
      projectName: 'constantinople',
      homeDir,
      shotPlanId: shotPlan.shotPlan.id,
    })).resolves.toMatchObject({
      shotPlan: {
        coverage: {
          sceneBeatsRevisionId: revision.activeRevisionId,
          beatIds: [beatId],
        },
      },
    });
  });
});

function revisionDocument(
  sceneId: string,
  blockId: string,
  castMemberId: string,
  locationId: string
): SceneBeatsInput {
  return {
    sceneId,
    beats: [
      {
        title: 'Decision',
        description: 'The decision lands in a held frame.',
        narrativeDevelopment: 'The scene reaches its visual decision.',
        narrativePurpose: 'Establish the decisive moment.',
        screenplayBlockIds: [blockId],
        castMemberIds: [castMemberId],
        locationIds: [locationId],
        propIds: [],
      },
    ],
  };
}
