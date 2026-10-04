import { describe, expect, it, vi } from 'vitest';
import type { MediaGenerationContextReport, ProjectRelativePath } from '@gorenku/studio-core/client';
import { renderMediaGenerationContext } from './index.js';
import { renderContextValue } from './values.js';
import { runGenerationCommand } from '../command.js';

const service = vi.hoisted(() => ({ readMediaGenerationContext: vi.fn() }));
vi.mock('@gorenku/studio-core/server', async (importOriginal) => ({
  ...await importOriginal<object>(),
  createProjectDataService: () => service,
}));

const report: MediaGenerationContextReport = {
  valid: true,
  project: { projectName: 'test', id: 'project_1', projectFolder: '/project',
    title: 'Film', aspectRatio: '16:9', languages: [], synopsis: '  Exact “dialogue”\n# Markdown\n雪  ' },
  purpose: 'image.edit', target: { kind: 'assetFile', assetFileId: 'asset_1' }, outputMediaKind: 'image',
  workflowPolicy: { codexPluginInstalled: false, codexGenerationReview: 'panel', codexGenerationReviewDisplayMode: 'inline', displayPreview: false, enableProviderPromptExpansion: true, provider: 'codex', askBeforeGenerating: false, concurrencyLimit: 1 },
  outputGuidance: { aspectRatio: null, quality: null },
  targetContext: { kind: 'assetFile', assetFileId: 'asset_1' }, visualLanguage: [],
  assetFiles: [{ id: 'file_1', owner: { kind: 'project' }, localeId: null, type: 'image',
    availability: 'ready', mediaKind: 'image', title: 'Similar title', oneLineSummary: 'Full description',
    referenceName: null, tags: [], origin: 'external', authoredFrom: null,
    createdAt: '2026-09-29', updatedAt: '2026-09-29',
    projectRelativePath: 'images/exact.png' as ProjectRelativePath, mimeType: 'image/png', sizeBytes: 0, contentHash: null, width: 1024, height: 1024, durationSeconds: null }],
  suggestedReferences: [{ id: 'source-image', role: 'source-image', candidates: [
    { assetFileId: 'file_1', available: true, isDisplaySelected: false, isWorkflowSelected: false },
  ] }], warnings: [], resourceKeys: ['project:information'],
};

describe('readable generation context', () => {
  it('preserves creative text, exact media identity, and explicit empty/false/zero values', () => {
    const before = structuredClone(report);
    const text = renderMediaGenerationContext(report);
    expect(text).toContain(report.project.synopsis);
    for (const value of ['codexGenerationReview: panel', 'codexGenerationReviewDisplayMode: inline', 'asset_1', 'file_1', 'images/exact.png', 'source-image', 'isDisplaySelected: false',
      'sizeBytes: 0', '## Warnings\n[]', '## Resource Keys', 'aspectRatio: null']) {
      expect(text).toContain(value);
    }
    expect(text.split('Full description')).toHaveLength(2);
    expect(report).toEqual(before);
  });

  it('preserves opaque identity types and complete nested document values', () => {
    const voiceIdentity = { id: '007', enabled: false, level: 0, extra: [null, '', { text: '雪\nquote "' }] };
    const text = renderContextValue({ voiceIdentity, notes: ['one', 'one'], empty: '', whitespace: '  ' });
    expect(text).toContain(JSON.stringify(voiceIdentity));
    expect(text.match(/one/g)).toHaveLength(2);
    expect(text).toContain('empty: ""');
    expect(text).toContain('whitespace: "  "');
  });

  it.each([false, true])('delegates once and writes only the requested format (json=%s)', async (json) => {
    service.readMediaGenerationContext.mockReset().mockResolvedValue(report);
    const log = vi.fn();
    await runGenerationCommand({ input: ['context'], flags: { purpose: 'image.edit', target: 'assetFile:asset_1' },
      json, io: { stdout: { log }, stderr: { error: vi.fn() } } });
    expect(service.readMediaGenerationContext).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    const output = log.mock.calls[0]![0];
    if (json) {
      expect(JSON.parse(output)).toEqual(report);
    } else {
      expect(output).toBe(renderMediaGenerationContext(report));
    }
  });
});
