import { describe, expect, it } from 'vitest';
import type { Asset } from '../../client/assets.js';
import type { ProjectRelativePath } from '../../client/project/index.js';
import type { ShotPlan } from '../../client/shot-plans.js';
import { GenerationAssets, projectGenerationAsset, projectGenerationVoice } from './reference-assets.js';
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
    const collection = new GenerationAssets();
    const { sample: _sample, ...facts } = voice;
    expect(projectGenerationVoice(voice, collection)).toEqual({ ...facts, sampleAssetId: asset.id });
    expect(collection.values()).toEqual([projectGenerationAsset(asset)]);
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
      projectFolder: '/nonexistent-renku-context-test', warnings, collection: new GenerationAssets(),
    });
    expect(result.candidates.map((candidate) => candidate.assetFileId)).toEqual(['preview', 'source']);
    expect(warnings).toHaveLength(2);
    result.candidates.forEach((candidate) => {
      expect(candidate).not.toHaveProperty('generationProvenance');
      expect(candidate).toMatchObject({ assetId: asset.id,
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
    const collection = new GenerationAssets();
    expect(projectGenerationShotPlan(plan, collection)).toEqual({ ...plan, shots: plan.shots.map(({ images, ...shot }) => ({ ...shot, imageAssetIds: images.map((image) => image.id) })) });
    expect(collection.values()).toEqual([projectGenerationAsset(asset)]);
    expect(plan).toEqual(before);
  });

  it('collects distinct identities once and rejects conflicting facts without replacing evidence', () => {
    const collection = new GenerationAssets();
    collection.add(asset);
    collection.add(structuredClone(asset));
    collection.add({ ...asset, id: 'asset_2' });
    expect(collection.values()).toEqual([
      projectGenerationAsset(asset), projectGenerationAsset({ ...asset, id: 'asset_2' }),
    ]);
    expect(() => collection.add({ ...asset, title: 'Conflicting title' })).toThrow('conflicting facts');
    expect(() => collection.add({ ...asset, title: 'Conflicting title' })).toThrow(expect.objectContaining({
      code: 'CORE_MEDIA_GENERATION_CONTEXT_INCONSISTENT_MEDIA',
    }));
    expect(collection.get(asset.id).title).toBe(asset.title);
    expect(() => collection.get('missing')).toThrow('cannot resolve Asset');
  });

  it('retains all files while scoped candidates preserve separate role and selection facts', () => {
    const files = ['image', 'audio'].map((mediaKind) => ({
      id: mediaKind, role: 'primary', mediaKind,
      projectRelativePath: `missing/${mediaKind}` as ProjectRelativePath,
      mimeType: null, sizeBytes: 0, contentHash: 'same-hash', width: null, height: null, durationSeconds: null,
    }));
    const source = { ...asset, files };
    const collection = new GenerationAssets();
    const common = { assets: [source], collection, fileIds: ['image'],
      projectFolder: '/nonexistent-renku-context-test', warnings: [] };
    const appearance = createReferenceSuggestion({ ...common, id: 'appearance', role: 'appearance', selectedAssetIds: [asset.id] });
    const sourceImage = createReferenceSuggestion({ ...common, id: 'source-image', role: 'source-image' });
    expect(collection.values()).toEqual([projectGenerationAsset(source)]);
    expect(appearance.candidates).toEqual([{ assetId: asset.id, assetFileId: 'image',
      isDisplaySelected: true, isWorkflowSelected: false, available: false }]);
    expect(sourceImage.candidates[0]?.isDisplaySelected).toBe(false);
  });
});
