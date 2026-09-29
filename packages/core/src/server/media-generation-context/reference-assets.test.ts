import { describe, expect, it } from 'vitest';
import type { Asset } from '../../client/assets.js';
import type { ProjectRelativePath } from '../../client/project/index.js';
import type { ShotPlan } from '../../client/shot-plans.js';
import { projectGenerationAsset, projectGenerationVoice } from './reference-assets.js';
import { projectGenerationShotPlan } from './shot-context.js';
import { createReferenceSuggestion } from './reference-suggestions.js';

describe('generation Asset projections', () => {
  const asset: Asset = {
    id: 'asset_1', owner: { kind: 'project' }, localeId: null,
    type: 'image', availability: 'ready', mediaKind: 'image', title: 'Reference',
    oneLineSummary: 'Authored description.', origin: 'generated', referenceName: 'Reference one',
    tags: ['continuity'], authoredFrom: { kind: 'shotPlan', id: 'plan_1' },
    files: [], createdAt: '2026-09-28', updatedAt: '2026-09-28',
    generationProvenance: {
      provider: 'external', model: 'model', mediaKind: 'image',
      prompt: 'Old instructions.', request: { prompt: 'Old instructions.' }, receipt: { id: 'receipt' },
    },
  };

  it.each([asset.generationProvenance, null])('omits the envelope without changing other fields or mutating the source', (generationProvenance) => {
    const source = { ...asset, generationProvenance };
    const before = structuredClone(source);
    const projected = projectGenerationAsset(source);
    expect(projected).not.toHaveProperty('generationProvenance');
    expect({ ...projected, generationProvenance }).toEqual(before);
    expect(source).toEqual(before);
  });

  it('preserves opaque voice identity and all non-sample voice fields', () => {
    const voice = {
      id: 'voice_1', castMemberId: 'cast_1', name: 'Voice', purpose: 'Dialogue', isDefault: true,
      voiceIdentity: { generationProvenance: 'opaque provider value' }, sample: asset,
      createdAt: '2026-09-28', updatedAt: '2026-09-28',
    };
    expect(projectGenerationVoice(voice)).toEqual({ ...voice, sample: projectGenerationAsset(asset) });
    expect(voice.sample.generationProvenance).toEqual(asset.generationProvenance);
  });

  it('retains multi-file ordering, selection and missing-file warnings without repeating history', () => {
    const files = ['source', 'preview'].map((role) => ({
      id: role, role, projectRelativePath: `missing/${role}.png` as ProjectRelativePath,
      mediaKind: 'image', mimeType: 'image/png', sizeBytes: null, contentHash: null,
      width: null, height: null, durationSeconds: null,
      createdAt: asset.createdAt, updatedAt: asset.updatedAt,
    }));
    const warnings: Parameters<typeof createReferenceSuggestion>[0]['warnings'] = [];
    const result = createReferenceSuggestion({
      id: 'continuity', role: 'continuity', assets: [{ ...asset, files }],
      selectedAssetIds: [asset.id], workflowSelectedAssetIds: [asset.id],
      projectFolder: '/nonexistent-renku-context-test', warnings,
    });
    expect(result.candidates.map((candidate) => candidate.assetFileId)).toEqual(['preview', 'source']);
    expect(warnings).toHaveLength(2);
    result.candidates.forEach((candidate) => {
      expect(candidate).not.toHaveProperty('generationProvenance');
      expect(candidate).toMatchObject({ assetId: asset.id, tags: asset.tags,
        isDisplaySelected: true, isWorkflowSelected: true, available: false });
    });
    expect(files.map((file) => file.role)).toEqual(['source', 'preview']);
  });

  it('preserves authored Shot briefs, selection, order, coverage and empty image collections', () => {
    const plan: ShotPlan = {
      type: 'shot-list', id: 'plan_1', number: 1, sceneId: 'scene_1', title: 'Plan',
      coverage: { sceneBeatsRevisionId: 'revision_1', beatIds: ['beat_1'] },
      createdAt: '2026-09-28', updatedAt: '2026-09-28',
      shots: [{ id: 'shot_1', number: '1', position: 0, title: 'Wide', description: 'Current direction.',
        brief: { lighting: { intent: 'Preserve this exact authored text.' } }, images: [asset], selectedImageId: asset.id },
      { id: 'shot_2', number: '2', position: 1, title: 'Close', description: '', brief: {}, images: [], selectedImageId: null }],
    };
    const before = structuredClone(plan);
    expect(projectGenerationShotPlan(plan)).toEqual({ ...plan, shots: [
      { ...plan.shots[0], images: [projectGenerationAsset(asset)] }, plan.shots[1],
    ] });
    expect(plan).toEqual(before);
  });
});
