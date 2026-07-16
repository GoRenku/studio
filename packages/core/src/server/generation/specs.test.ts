import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { GenerationSpec } from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createGenerationSpec,
  readGenerationSpec,
  updateGenerationSpec,
} from './specs.js';
import type { GenerationPurposeContract } from './purpose-contract.js';

describe('generic generation spec editing persistence', () => {
  it('round-trips partial and provider-invalid authored state unchanged', () => {
    const session = createMemorySession();
    const spec: GenerationSpec = {
      purpose: 'image.edit',
      target: { kind: 'asset', id: 'asset-1' },
      model: { provider: 'missing-provider' },
      values: { prompt: '', quality: 'authored-provider-value' },
      references: [{
        id: 'selection-1',
        placement: {
          kind: 'slot',
          sectionId: 'source',
          slotId: 'source-image',
        },
        reference: {
          kind: 'project-file',
          projectRelativePath: 'assets/missing.png' as never,
        },
      }],
      title: 'Incomplete edit',
    };
    createGenerationSpec({
      id: 'spec-1',
      spec,
      purpose: purposeContract(),
      session,
      now: '2026-07-12T10:00:00.000Z',
    });

    expect(readGenerationSpec({ id: 'spec-1', session }).spec).toEqual(spec);

    const updated = structuredClone(spec);
    updated.model = undefined;
    updated.references[0]!.providerField = 'image_urls';
    updateGenerationSpec({
      id: 'spec-1',
      spec: updated,
      purpose: purposeContract(),
      session,
      now: '2026-07-12T11:00:00.000Z',
    });
    expect(readGenerationSpec({ id: 'spec-1', session }).spec).toEqual(updated);
  });

  it('rejects only invalid guide placement structure', () => {
    const session = createMemorySession();
    const spec: GenerationSpec = {
      purpose: 'image.edit',
      target: { kind: 'asset', id: 'asset-1' },
      values: {},
      references: [
        selection('first'),
        selection('second'),
      ],
    };

    expect(() => createGenerationSpec({
      id: 'spec-1',
      spec,
      purpose: purposeContract(),
      session,
      now: '2026-07-12T10:00:00.000Z',
    })).toThrow(/accepts one current selection/);
  });
});

function selection(id: string) {
  return {
    id,
    placement: {
      kind: 'slot' as const,
      sectionId: 'source',
      slotId: 'source-image',
    },
    reference: {
      kind: 'project-file' as const,
      projectRelativePath: `assets/${id}.png` as never,
    },
  };
}

function purposeContract(): GenerationPurposeContract {
  return {
    purpose: 'image.edit',
    targetKind: 'asset' as const,
    outputMediaKind: 'image' as const,
  };
}

function createMemorySession(): DatabaseSession {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    create table media_generation_spec (
      id text primary key not null,
      purpose text not null,
      target_kind text not null,
      target_id text not null,
      provider text,
      model text,
      title text,
      values_json text not null,
      references_json text not null,
      created_at text not null,
      updated_at text not null
    );
  `);
  return {
    databasePath: ':memory:',
    db: drizzle(sqlite),
    close: () => sqlite.close(),
  };
}
