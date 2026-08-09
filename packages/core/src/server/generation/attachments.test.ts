import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { readLookbookImageRecordByAsset } from '../database/access/lookbook-images.js';
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
    const propId = await ensureProp(projectData, homeDir);
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
      {
        purpose: 'prop.sheet' as const,
        target: { kind: 'prop' as const, id: propId },
        resourceKey: `surface:prop:${propId}`,
      },
      {
        purpose: 'prop.hero' as const,
        target: { kind: 'prop' as const, id: propId },
        resourceKey: `surface:prop:${propId}`,
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
        projectName: 'constantinople',
        projectFolder: created.projectPath,
      });
      if (attachment.purpose === 'prop.sheet') {
        expect(report.asset.files[0]?.projectRelativePath).toBe(
          'props/field-cannon/attachment.png'
        );
      }
      if (attachment.purpose === 'prop.hero') {
        expect(report.asset.files[0]?.projectRelativePath).toBe(
          'props/field-cannon/attachment-2.png'
        );
      }
    }

    const propContext = await projectData.readPropContext({
      homeDir,
      propId,
    });
    expect(propContext.assets.map((asset) => asset.type)).toEqual(
      expect.arrayContaining(['prop_sheet', 'prop_hero'])
    );
  });

  it('keeps Prop Hero storage naming independent from the Asset title', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const propId = await ensureProp(projectData, homeDir);
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'hero.png'), 'image');

    const report = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'prop.hero',
      target: { kind: 'prop', id: propId },
      title: 'Field Cannon Presentation Hero',
      sourceProjectRelativePath: 'tmp/hero.png',
    });

    expect(report.asset.title).toBe('Field Cannon Presentation Hero');
    expect(report.asset.files[0]?.projectRelativePath).toBe(
      'props/field-cannon/hero.png'
    );
  });

  it('atomically selects canonical imports and rejects request-scoped selection before writes', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const lookbooks = await ensureLookbooks(homeDir);
    const propId = await ensureProp(projectData, homeDir);
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(
      path.join(created.projectPath, 'tmp', 'selected.png'),
      'selected image'
    );

    const cases = [
      {
        purpose: 'cast.profile' as const,
        target: { kind: 'castMember' as const, id: 'cast_test0001' },
        owner: { kind: 'castMember' as const, id: 'cast_test0001' },
      },
      {
        purpose: 'location.hero' as const,
        target: { kind: 'location' as const, id: 'location_test0001' },
        owner: { kind: 'location' as const, id: 'location_test0001' },
      },
      {
        purpose: 'prop.hero' as const,
        target: { kind: 'prop' as const, id: propId },
        owner: { kind: 'prop' as const, id: propId },
      },
      {
        purpose: 'lookbook.image' as const,
        target: { kind: 'lookbook' as const, id: lookbooks.production },
        owner: { kind: 'lookbook' as const, id: lookbooks.production },
      },
    ];

    for (const attachment of cases) {
      const report = await projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: attachment.purpose,
        target: attachment.target,
        sourceProjectRelativePath: 'tmp/selected.png',
        select: true,
      });
      const page = await projectData.listAssetPage({
        projectName: 'constantinople',
        homeDir,
        owner: attachment.owner,
      });
      expect(page.selectedAssetId).toBe(report.asset.id);
      expect(page.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: report.asset.id,
            owner: attachment.owner,
          }),
        ])
      );
    }

    const before = await projectData.listAssets({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'castMember', id: 'cast_test0001' },
    });
    await expect(
      projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'cast.character-sheet',
        target: { kind: 'castMember', id: 'cast_test0001' },
        sourceProjectRelativePath: 'tmp/selected.png',
        select: true,
      })
    ).rejects.toMatchObject({
      code: 'CORE_ASSET_SELECTION_UNSUPPORTED',
    });
    const after = await projectData.listAssets({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'castMember', id: 'cast_test0001' },
    });
    expect(after.map((asset) => asset.id)).toEqual(
      before.map((asset) => asset.id)
    );

    const propAssetsBefore = await projectData.listAssets({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'prop', id: propId },
    });
    await expect(
      projectData.attachGenerationMedia({
        projectName: 'constantinople',
        homeDir,
        purpose: 'prop.sheet',
        target: { kind: 'prop', id: propId },
        sourceProjectRelativePath: 'tmp/selected.png',
        select: true,
      })
    ).rejects.toMatchObject({
      code: 'CORE_ASSET_SELECTION_UNSUPPORTED',
    });
    const propAssetsAfter = await projectData.listAssets({
      projectName: 'constantinople',
      homeDir,
      owner: { kind: 'prop', id: propId },
    });
    expect(propAssetsAfter.map((asset) => asset.id)).toEqual(
      propAssetsBefore.map((asset) => asset.id)
    );
  });

  it('attaches a frozen external image edit to the exact current source owner', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'source.png'), 'source');
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'edited.png'), 'edited');

    const source = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: 'cast_test0001' },
      sourceProjectRelativePath: 'tmp/source.png',
      title: 'Source Character Sheet',
    });
    const sourceFile = source.asset.files[0]!;
    const spec = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        executionKind: 'agent-external',
        purpose: 'image.edit',
        target: { kind: 'asset', id: source.asset.id },
        model: { provider: 'codex', model: 'gpt-image-2' },
        values: { prompt: 'Preserve the source and change its lighting.' },
        references: [{
          placement: {
            kind: 'slot',
            sectionId: 'source',
            slotId: 'source-image',
          },
          reference: {
            kind: 'asset-file',
            assetId: source.asset.id,
            assetFileId: sourceFile.id,
          },
        }],
      },
    });
    await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: spec.id,
    });

    await expect(projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: 'cast_test0001' },
      sourceProjectRelativePath: 'tmp/edited.png',
      receipt: {},
      sourceSpecId: spec.id,
      title: 'Edited Character Sheet',
    })).rejects.toMatchObject({
      code: 'CORE_GENERATION_ATTACHMENT_PROVENANCE_CONFLICT',
    });

    await expect(projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: 'cast_test0002' },
      sourceProjectRelativePath: 'tmp/edited.png',
      sourceSpecId: spec.id,
      title: 'Edited Character Sheet',
    })).rejects.toMatchObject({
      code: 'CORE_GENERATION_ATTACHMENT_IMAGE_EDIT_SOURCE_MISMATCH',
    });

    const edited = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: 'cast_test0001' },
      sourceProjectRelativePath: 'tmp/edited.png',
      sourceSpecId: spec.id,
      title: 'Edited Character Sheet',
    });
    expect(edited.provenance).toEqual({ generationSpecId: spec.id });
    expect(edited.asset.id).not.toBe(source.asset.id);
    expect(await fs.readFile(
      path.join(created.projectPath, sourceFile.projectRelativePath),
      'utf8',
    )).toBe('source');
  });

  it('attaches an exact managed image edit receipt to the source owner', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'managed-source.png'), 'source');

    const source = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: 'cast_test0001' },
      sourceProjectRelativePath: 'tmp/managed-source.png',
      title: 'Managed Source Character Sheet',
    });
    const sourceFile = source.asset.files[0]!;
    const spec = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        executionKind: 'renku-managed',
        purpose: 'image.edit',
        target: { kind: 'asset', id: source.asset.id },
        model: { provider: 'fal-ai', model: 'openai/gpt-image-2/edit' },
        values: { prompt: 'Preserve the source and change its lighting.' },
        references: [{
          placement: {
            kind: 'slot',
            sectionId: 'source',
            slotId: 'source-image',
          },
          providerField: 'image_urls',
          reference: {
            kind: 'asset-file',
            assetId: source.asset.id,
            assetFileId: sourceFile.id,
          },
        }],
      },
    });
    const estimate = await projectData.estimateGeneration({
      projectName: 'constantinople',
      homeDir,
      specId: spec.id,
    });
    expect(estimate.valid).toBe(true);
    if (!estimate.valid) {
      return;
    }
    const run = await projectData.runGeneration({
      projectName: 'constantinople',
      homeDir,
      specId: spec.id,
      approvalToken: estimate.estimate.approvalToken,
      mode: 'simulated',
    });
    expect(run.valid).toBe(true);
    if (!run.valid) {
      return;
    }
    const output = run.run.outputs[0]?.projectRelativePath;
    if (!output) {
      throw new Error('Expected a simulated image-edit output.');
    }
    const outputPath = path.join(created.projectPath, output);
    const generatedContents = await fs.readFile(outputPath);
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'wrong-output.png'), 'wrong');
    await expect(projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: 'cast_test0001' },
      sourceProjectRelativePath: 'tmp/wrong-output.png',
      receipt: { run: run.run },
    })).rejects.toMatchObject({
      code: 'CORE_GENERATION_ATTACHMENT_PROVENANCE_INVALID',
    });

    await fs.writeFile(outputPath, 'replacement');
    await expect(projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: 'cast_test0001' },
      sourceProjectRelativePath: output,
      receipt: { run: run.run },
      title: 'Edited Character Sheet',
    })).rejects.toMatchObject({
      code: 'CORE_ASSET_FILE_GENERATION_OUTPUT_MISMATCH',
    });
    await fs.writeFile(outputPath, generatedContents);

    const edited = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'cast.character-sheet',
      target: { kind: 'castMember', id: 'cast_test0001' },
      sourceProjectRelativePath: output,
      receipt: { run: run.run },
      title: 'Edited Character Sheet',
    });
    expect(edited.provenance).toEqual({ generationRunId: run.run.id });
    expect(edited.asset.id).not.toBe(source.asset.id);
  });

  it('attaches an external image edit through Lookbook membership only', async () => {
    const projectData = createProjectDataService();
    const created = await createSampleMovieProject({ projectData, homeDir });
    if (!created) {
      return;
    }
    const lookbooks = await ensureLookbooks(homeDir);
    await fs.mkdir(path.join(created.projectPath, 'tmp'), { recursive: true });
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'lookbook-source.png'), 'source');
    await fs.writeFile(path.join(created.projectPath, 'tmp', 'lookbook-edited.png'), 'edited');

    const source = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: lookbooks.production },
      sourceProjectRelativePath: 'tmp/lookbook-source.png',
      title: 'Source Lookbook Image',
    });
    const spec = await projectData.createGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      spec: {
        executionKind: 'agent-external',
        purpose: 'image.edit',
        target: { kind: 'asset', id: source.asset.id },
        model: { provider: 'codex', model: 'gpt-image-2' },
        values: { prompt: 'Preserve the source and change its lighting.' },
        references: [{
          placement: {
            kind: 'slot',
            sectionId: 'source',
            slotId: 'source-image',
          },
          reference: {
            kind: 'asset-file',
            assetId: source.asset.id,
            assetFileId: source.asset.files[0]!.id,
          },
        }],
      },
    });
    await projectData.freezeGenerationSpec({
      projectName: 'constantinople',
      homeDir,
      specId: spec.id,
    });

    await expect(projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'lookbook.storyboard-sheet',
      target: { kind: 'lookbook', id: lookbooks.storyboard },
      sourceProjectRelativePath: 'tmp/lookbook-edited.png',
      sourceSpecId: spec.id,
      title: 'Edited Lookbook Image',
    })).rejects.toMatchObject({
      code: 'CORE_GENERATION_ATTACHMENT_IMAGE_EDIT_SOURCE_MISMATCH',
    });

    const edited = await projectData.attachGenerationMedia({
      projectName: 'constantinople',
      homeDir,
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: lookbooks.production },
      sourceProjectRelativePath: 'tmp/lookbook-edited.png',
      sourceSpecId: spec.id,
      title: 'Edited Lookbook Image',
    });
    expect(edited.provenance).toEqual({ generationSpecId: spec.id });
    expect(edited.ownerRecord).toMatchObject({ kind: 'lookbookImage' });
    expect(edited.asset.id).not.toBe(source.asset.id);
    expect(edited.asset.owner).toEqual({
      kind: 'lookbook',
      id: lookbooks.production,
    });

    const { session } = await openProjectSession({
      projectName: 'constantinople',
      homeDir,
    });
    try {
      expect(readLookbookImageRecordByAsset(session, {
        lookbookId: lookbooks.production,
        assetId: edited.asset.id,
      })).not.toBeNull();
    } finally {
      session.close();
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

async function ensureProp(
  projectData: ReturnType<typeof createProjectDataService>,
  homeDir: string
): Promise<string> {
  const report = await projectData.applyPropOperations({
    homeDir,
    document: {
      kind: 'propOperations',
      operations: [
        {
          operation: 'prop.add',
          prop: {
            key: 'field-cannon',
            handle: 'field-cannon',
            name: 'Field Cannon',
          },
        },
      ],
    },
  });
  return report.generatedIds?.[0]?.id as string;
}
