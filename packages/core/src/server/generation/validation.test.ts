import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { GenerationPurpose, GenerationSpec } from '../../client/generation.js';
import type { GenerationPurposeContract } from './purpose-contract.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { validateGenerationSpec } from './validation.js';

describe('generic generation execution validation', () => {
  it('collects independent provider value and media issues', async () => {
    const projectFolder = await createProjectFolder();
    const report = await validateGenerationSpec({
      spec: {
        purpose: 'image.edit',
        target: { kind: 'asset', id: 'asset-1' },
        model: { provider: 'fal-ai', model: 'openai/gpt-image-2/edit' },
        values: {},
        references: [],
      },
      purpose: imagePurpose('image.edit', 'asset'),
      session: unusedSession(),
      projectFolder,
    });

    expect(report.valid).toBe(false);
    if (!report.valid) {
      expect(report.diagnostics.map((issue) => issue.location.path.join('.'))).toEqual(
        expect.arrayContaining(['values.prompt', 'references.image_urls'])
      );
    }
  });

  it('accepts exact compatible project media without owner or purpose policy', async () => {
    const projectFolder = await createProjectFolder();
    const spec = imageEditSpec('references/location-sheet.png');
    await mkdir(path.join(projectFolder, 'references'), { recursive: true });
    await writeFile(path.join(projectFolder, 'references/location-sheet.png'), 'opaque image bytes');

    const report = await validateGenerationSpec({
      spec,
      purpose: imagePurpose('cast.profile', 'castMember'),
      session: unusedSession(),
      projectFolder,
    });

    expect(report).toEqual({ valid: true, spec, diagnostics: [] });
  });

  it('ignores excluded and provider-unassigned references', async () => {
    const projectFolder = await createProjectFolder();
    const spec: GenerationSpec = {
      purpose: 'image.create',
      target: { kind: 'project', id: 'project-1' },
      model: { provider: 'fal-ai', model: 'openai/gpt-image-2' },
      values: { prompt: 'Keep this prompt exactly.' },
      references: [{
        id: 'excluded',
        placement: { kind: 'additional' },
        included: false,
        reference: {
          kind: 'project-file',
          projectRelativePath: 'missing/reference.png' as never,
        },
      }],
    };

    const report = await validateGenerationSpec({
      spec,
      purpose: imagePurpose('image.create', 'project'),
      session: unusedSession(),
      projectFolder,
    });

    expect(report.valid).toBe(true);
  });

  it('rejects an exact image assigned to a text-only endpoint', async () => {
    const projectFolder = await createProjectFolder();
    await mkdir(path.join(projectFolder, 'references'), { recursive: true });
    await writeFile(path.join(projectFolder, 'references/source.png'), 'opaque image bytes');
    const spec = imageEditSpec('references/source.png');
    spec.model = { provider: 'fal-ai', model: 'openai/gpt-image-2' };

    const report = await validateGenerationSpec({
      spec,
      purpose: imagePurpose('cast.profile', 'castMember'),
      session: unusedSession(),
      projectFolder,
    });

    expect(report.valid).toBe(false);
    if (!report.valid) {
      expect(report.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({
          location: { path: ['references', '0', 'providerField'] },
        }),
      ]));
    }
  });
});

function imageEditSpec(projectRelativePath: string): GenerationSpec {
  return {
    purpose: 'cast.profile',
    target: { kind: 'castMember', id: 'cast-1' },
    model: { provider: 'fal-ai', model: 'openai/gpt-image-2/edit' },
    values: { prompt: 'Preserve this exact prompt.' },
    references: [{
      id: 'reference-1',
      placement: { kind: 'additional' },
      included: true,
      providerField: 'image_urls',
      reference: {
        kind: 'project-file',
        projectRelativePath: projectRelativePath as never,
      },
    }],
  };
}

function imagePurpose(purpose: GenerationPurpose, targetKind: 'asset' | 'castMember' | 'project'): GenerationPurposeContract {
  return {
    purpose,
    targetKind,
    outputMediaKind: 'image' as const,
  };
}

async function createProjectFolder(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), 'renku-generation-validation-'));
}

function unusedSession(): DatabaseSession {
  return {} as DatabaseSession;
}
