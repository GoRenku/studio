import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { buildGenerationPreview } from './previews.js';

describe('generic generation preview', () => {
  it('renders incomplete editing state without provider readiness', async () => {
    const preview = await buildGenerationPreview({
      spec: {
        executionKind: 'renku-managed',
        purpose: 'image.create',
        target: { kind: 'project', id: 'project-1' },
        values: {},
        references: [{
          placement: { kind: 'additional' },
          reference: {
            kind: 'project-file',
            projectRelativePath: 'missing/reference.png' as never,
          },
        }],
      },
      referenceGuide: { sections: [], notices: [] },
      session: {} as DatabaseSession,
      projectFolder: await mkdtemp(
        path.join(os.tmpdir(), 'renku-generation-preview-')
      ),
    });

    expect(preview.spec.model).toBeUndefined();
    expect(preview.references).toEqual([
      expect.objectContaining({
        resolved: null,
      }),
    ]);
    expect(preview.diagnostics).toHaveLength(1);
    expect(preview).not.toHaveProperty('providerPayload');
  });
});
