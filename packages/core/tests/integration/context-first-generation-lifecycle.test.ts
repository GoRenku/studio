import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createProjectDataService,
  readAssetFileGenerationRequest,
} from '../../src/server/index.js';
import { writeConfig } from '../../src/server/testing/project-data-fixtures.js';
import { createIsolatedSampleMovieProjectFromTemplate } from '../../src/server/testing/movie-project-template-fixtures.js';
import { normalizeProjectRelativePath } from '../../src/server/files/project-relative-paths.js';

describe('context-first generation lifecycle', () => {
  let homeDir: string;
  const projectName = 'constantinople';
  const projectData = createProjectDataService();

  beforeAll(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-generation-integration-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    const project = await createIsolatedSampleMovieProjectFromTemplate({
      homeDir,
      projectData,
    });
    if (!project) {
      throw new Error('Expected the sample movie project fixture.');
    }
  });

  it('projects, estimates, simulates, and attaches one exact Cast Profile request', async () => {
    const context = await projectData.buildGenerationContext({
      homeDir,
      projectName,
      purpose: 'cast.profile',
      target: { kind: 'castMember', id: 'cast_test0002' },
    });
    expect(context.settings).toMatchObject({
      fixed: [{ kind: 'aspect-ratio', value: '1:1' }],
      recommended: [{ kind: 'quality', value: 'medium' }],
    });

    const created = await projectData.createGenerationSpec({
      homeDir,
      projectName,
      spec: {
        executionKind: 'renku-managed',
        purpose: 'cast.profile',
        target: { kind: 'castMember', id: 'cast_test0002' },
        model: { provider: 'fal-ai', model: 'nano-banana-2' },
        values: { prompt: 'An exact opaque profile prompt.' },
        references: [],
      },
    });
    expect(created.spec.values).toMatchObject({ aspect_ratio: '1:1' });
    expect(created.spec.values).not.toHaveProperty('resolution');
    await expect(projectData.updateGenerationPreviewResource({
      homeDir,
      projectName,
      specId: created.id,
      prompt: { authoredText: 'Updated managed prompt.' },
      parameterValues: {},
      slotSelections: [],
    })).rejects.toMatchObject({
      code: 'CORE_GENERATION_PREVIEW_MODEL_REQUIRED',
    });

    const estimate = await projectData.estimateGeneration({
      homeDir,
      projectName,
      specId: created.id,
    });
    expect(estimate.valid).toBe(true);
    if (!estimate.valid) return;

    const run = await projectData.runGeneration({
      homeDir,
      projectName,
      specId: created.id,
      approvalToken: estimate.estimate.approvalToken,
      mode: 'simulated',
    });
    expect(run.valid).toBe(true);
    if (!run.valid) return;
    expect(run.run.status).toBe('simulated');
    expect(run.run.outputs).toHaveLength(1);

    const output = run.run.outputs[0]!;
    if (!output.projectRelativePath) {
      throw new Error('Expected a simulated project-relative output path.');
    }
    const attachment = await projectData.attachGenerationMedia({
      homeDir,
      projectName,
      purpose: 'cast.profile',
      target: { kind: 'castMember', id: 'cast_test0002' },
      sourceProjectRelativePath: output.projectRelativePath,
      receipt: { run: run.run },
    });
    expect(attachment.provenance).toEqual({
      generationRunId: run.run.id,
    });
    if (!('files' in attachment.asset)) {
      throw new Error('Expected an attached Cast Profile Asset.');
    }
    const managedRequest = await readAssetFileGenerationRequest({
      homeDir,
      projectName,
      assetId: attachment.asset.assetId,
      assetFileId: attachment.asset.files[0]!.id,
    });
    expect(managedRequest).toMatchObject({
      purpose: 'cast.profile',
      finalPrompt: { authoredText: 'An exact opaque profile prompt.' },
      model: { executionPath: 'renku-managed' },
    });
    expect(managedRequest.configuration.sections[0]?.rows[0])
      .toMatchObject({ value: 'fal-ai/nano-banana-2' });
    expect(managedRequest).not.toHaveProperty('providerPreview');

    const reusable = await projectData.listGenerationReferences({
      homeDir,
      projectName,
      mediaKind: 'image',
    });
    expect(reusable.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reference: expect.objectContaining({ assetId: attachment.asset.assetId }),
        provenance: { origin: 'generated', generationRunId: run.run.id },
      }),
    ]));
  });

  it('saves a Codex request on its image and exposes the exact read-only request', async () => {
    const current = await projectData.readCurrentProject({ homeDir });
    if (!current) throw new Error('Expected current project.');
    await fs.mkdir(path.join(current.projectFolder, 'research'), { recursive: true });
    await fs.writeFile(path.join(current.projectFolder, 'research', 'helmet.jpg'), 'reference');
    const originalPrompt = 'Keep the exact authored Codex prompt.';
    const spec = {
      executionKind: 'agent-external' as const,
      purpose: 'cast.character-sheet' as const,
      target: { kind: 'castMember' as const, id: 'cast_test0002' },
      model: { provider: 'codex', model: 'gpt-image-2' },
      values: {
        prompt: originalPrompt,
      },
      references: [{
        placement: { kind: 'additional' as const },
        reference: {
          kind: 'project-file' as const,
          projectRelativePath: normalizeProjectRelativePath('research/helmet.jpg'),
        },
      }],
      title: 'Codex character sheet',
    };
    const saved = await projectData.createGenerationSpec({
      homeDir,
      projectName,
      spec,
    });
    expect(saved.spec).toEqual(spec);

    const preview = await projectData.buildGenerationPreview({
      homeDir,
      projectName,
      specId: saved.id,
    });
    expect(preview).toMatchObject({
      spec: {
        executionKind: 'agent-external',
        model: { provider: 'codex', model: 'gpt-image-2' },
        values: { prompt: originalPrompt },
      },
    });
    expect(preview).not.toHaveProperty('providerPayload');

    const updatedPrompt = 'Use the prompt saved from the editable Preview.';
    await expect(projectData.updateGenerationPreviewResource({
      homeDir,
      projectName,
      specId: saved.id,
      prompt: { authoredText: updatedPrompt },
      parameterValues: { quality: 'high' },
      slotSelections: [],
    })).rejects.toMatchObject({
      code: 'CORE_GENERATION_PREVIEW_EXTERNAL_PARAMETERS_UNSUPPORTED',
    });
    const updatedPreview = await projectData.updateGenerationPreviewResource({
      homeDir,
      projectName,
      specId: saved.id,
      prompt: { authoredText: updatedPrompt },
      parameterValues: {},
      slotSelections: [],
    });
    expect(updatedPreview).toMatchObject({
      generationSpec: { id: saved.id, frozenAt: null },
      finalPrompt: { authoredText: updatedPrompt },
      model: {
        provider: 'codex',
        modelId: 'gpt-image-2',
        executionPath: 'agent-external',
      },
      authoring: { selectedModelFamilyId: '', modelFamilies: [], controls: [] },
    });
    expect(
      await projectData.readGenerationSpec({
        homeDir,
        projectName,
        specId: saved.id,
      })
    ).toMatchObject({
      spec: {
        values: {
          prompt: updatedPrompt,
        },
      },
    });

    const source = 'tmp/media/codex-character-sheet.png';
    const absoluteSource = path.join(current.projectFolder, source);
    await fs.mkdir(path.dirname(absoluteSource), { recursive: true });
    await fs.writeFile(absoluteSource, Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64'
    ));
    await expect(projectData.attachGenerationMedia({
      homeDir,
      projectName,
      purpose: spec.purpose,
      target: spec.target,
      sourceProjectRelativePath: source,
      title: spec.title,
      sourceSpecId: saved.id,
    })).rejects.toMatchObject({ code: 'CORE_GENERATION_ATTACHMENT_SOURCE_SPEC_MUTABLE' });
    const frozen = await projectData.freezeGenerationSpec({
      homeDir,
      projectName,
      specId: saved.id,
    });
    expect(frozen.frozenAt).toEqual(expect.any(String));
    const attachment = await projectData.attachGenerationMedia({
      homeDir,
      projectName,
      purpose: spec.purpose,
      target: spec.target,
      sourceProjectRelativePath: source,
      title: spec.title,
      sourceSpecId: saved.id,
    });
    expect(attachment.provenance).toEqual({
      generationSpecId: saved.id,
    });
    if (!('files' in attachment.asset)) {
      throw new Error('Expected an attached Asset.');
    }

    const request = await readAssetFileGenerationRequest({
      homeDir,
      projectName,
      assetId: attachment.asset.assetId,
      assetFileId: attachment.asset.files[0]!.id,
    });
    expect(request).toMatchObject({
      purpose: 'cast.character-sheet',
      target: spec.target,
      finalPrompt: { authoredText: updatedPrompt },
      model: {
        provider: 'codex',
        modelId: 'gpt-image-2',
        executionPath: 'agent-external',
      },
      references: {
        additional: [{
          identity: {
            kind: 'project-file',
            projectRelativePath: 'research/helmet.jpg',
          },
          selected: true,
        }],
      },
    });
  });

  it('keeps an external attachment target-owned while exposing it in the generic catalog', async () => {
    const current = await projectData.readCurrentProject({ homeDir });
    if (!current) throw new Error('Expected current project.');
    const source = 'tmp/media/external-profile.png';
    const absoluteSource = path.join(current.projectFolder, source);
    await fs.mkdir(path.dirname(absoluteSource), { recursive: true });
    await fs.writeFile(absoluteSource, Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
      'base64'
    ));

    const attachment = await projectData.attachGenerationMedia({
      homeDir,
      projectName,
      purpose: 'cast.profile',
      target: { kind: 'castMember', id: 'cast_test0002' },
      sourceProjectRelativePath: source,
      title: 'External profile',
    });
    expect(attachment.provenance).toBeNull();

    const reusable = await projectData.listGenerationReferences({
      homeDir,
      projectName,
      mediaKind: 'image',
    });
    expect(reusable.items.some((item) =>
      item.reference.kind === 'asset-file' &&
      item.reference.assetId === attachment.asset.assetId
    )).toBe(true);

    const owned = await projectData.listGenerationReferences({
      homeDir,
      projectName,
      mediaKind: 'image',
      owner: { kind: 'castMember', id: 'cast_test0002' },
    });
    expect(owned.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        reference: expect.objectContaining({ assetId: attachment.asset.assetId }),
        provenance: { origin: 'external' },
      }),
    ]));
  });
});
