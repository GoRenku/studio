import { describe, expect, it } from 'vitest';
import { renderMediaImport } from './output.js';

describe('media import completion display', () => {
  const provenance = { prompt: 'long recipe '.repeat(10000), receipt: { seed: 7 } };
  const asset = { id: 'asset_one', generationProvenance: provenance,
    files: [{ id: 'file_one', projectRelativePath: 'media/take.mp4' }] };

  it('keeps exact file and owner identities without echoing recipes or mutating the report', () => {
    const report = { valid: true, purpose: 'shot-plan.video-generation',
      target: { kind: 'shotPlan', id: 'plan_one' }, asset, generationProvenance: provenance,
      ownerRecord: { kind: 'lookbookImage', id: 'owner_one' }, resourceKeys: ['project:movie'] };
    const output = renderMediaImport(report as never);
    expect(output).toContain('media/take.mp4');
    expect(output).toContain('owner_one');
    expect(output).toContain('file_one');
    expect(output).not.toContain('long recipe');
    expect(output.length).toBeLessThan(1000);
    expect(report.asset.generationProvenance).toBe(provenance);
    expect(report.generationProvenance).toBe(provenance);
  });

  it('keeps grouped files, selection changes, warnings, and revision facts', () => {
    const report = { valid: true, purpose: 'scene.storyboard-sheet', imported: [asset],
      files: [{ beatId: 'beat_one', projectRelativePath: 'media/beat.png' }],
      sceneBeatsRevisionId: 'revision_one', changes: [{ type: 'selected', id: 'asset_one' }],
      warnings: [{ code: 'TEST_WARNING', message: 'Keep this warning' }] };
    const output = renderMediaImport(report as never);
    for (const value of ['beat_one', 'revision_one', 'selected', 'Keep this warning', 'media/beat.png']) {
      expect(output).toContain(value);
    }
    expect(output).not.toContain('long recipe');
    expect(report.imported[0].generationProvenance).toBe(provenance);
  });
});
