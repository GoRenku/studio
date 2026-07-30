import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import type { GenerationSpec } from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createGenerationSpec,
  listGenerationSpecs,
  readGenerationSpec,
  updateGenerationSpec,
} from './specs.js';
import type { GenerationPurposeContract } from './purpose-contract.js';

describe('generic generation spec editing persistence', () => {
  it('round-trips partial and provider-invalid authored state unchanged', () => {
    const session = createMemorySession();
    const spec: GenerationSpec = {
      executionKind: 'renku-managed',
      purpose: 'image.edit',
      target: { kind: 'asset', id: 'asset-1' },
      model: { provider: 'missing-provider' },
      values: { prompt: '', quality: 'authored-provider-value' },
      references: [{
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
      executionKind: 'renku-managed',
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

  it('round-trips and filters soft Shot Plan authoring context', () => {
    const session = createMemorySession();
    const purpose = {
      purpose: 'image.create' as const,
      targetKind: 'project' as const,
      outputMediaKind: 'image' as const,
    };
    createGenerationSpec({
      id: 'spec-shot-plan',
      spec: {
        purpose: 'image.create',
        target: { kind: 'project', id: 'project-1' },
        authoredFrom: { kind: 'shotPlan', id: 'shot-plan-missing' },
        executionKind: 'agent-external',
        values: {},
        references: [],
      },
      purpose,
      session,
      now: '2026-07-24T10:00:00.000Z',
    });
    createGenerationSpec({
      id: 'spec-project',
      spec: {
        purpose: 'image.create',
        target: { kind: 'project', id: 'project-1' },
        executionKind: 'agent-external',
        values: {},
        references: [],
      },
      purpose,
      session,
      now: '2026-07-24T10:01:00.000Z',
    });

    expect(readGenerationSpec({
      id: 'spec-shot-plan',
      session,
    }).spec.authoredFrom).toEqual({
      kind: 'shotPlan',
      id: 'shot-plan-missing',
    });
    expect(listGenerationSpecs({
      session,
      authoredFrom: { kind: 'shotPlan', id: 'shot-plan-missing' },
    }).map((record) => record.id)).toEqual(['spec-shot-plan']);

    expect(() => createGenerationSpec({
      id: 'spec-invalid-origin',
      spec: {
        purpose: 'image.create',
        target: { kind: 'project', id: 'project-1' },
        authoredFrom: { kind: 'shotPlan', id: ' ' },
        executionKind: 'agent-external',
        values: {},
        references: [],
      },
      purpose,
      session,
      now: '2026-07-24T10:02:00.000Z',
    })).toThrow(expect.objectContaining({
      code: 'CORE_GENERATION_SPEC_INVALID',
    }));
  });

  it('persists the explicit Shot Plan video input mode without resolving the source plan', () => {
    const session = createMemorySession();
    const purpose = {
      purpose: 'shot-plan.video-generation' as const,
      targetKind: 'project' as const,
      outputMediaKind: 'video' as const,
    };
    const spec: GenerationSpec = {
      purpose: 'shot-plan.video-generation',
      target: { kind: 'project', id: 'project-1' },
      authoredFrom: { kind: 'shotPlan', id: 'shot-plan-missing' },
      shotPlanVideoInputMode: 'first-last-frame',
      executionKind: 'agent-external',
      values: {},
      references: [],
    };

    createGenerationSpec({
      id: 'spec-video',
      spec,
      purpose,
      session,
      now: '2026-07-30T10:00:00.000Z',
    });

    expect(readGenerationSpec({ id: 'spec-video', session }).spec).toEqual(spec);

    const updated = { ...spec, shotPlanVideoInputMode: 'reference' as const };
    updateGenerationSpec({
      id: 'spec-video',
      spec: updated,
      purpose,
      session,
      now: '2026-07-30T10:01:00.000Z',
    });
    expect(readGenerationSpec({ id: 'spec-video', session }).spec).toEqual(updated);
  });

  it('enforces the Shot Plan video source and input-mode envelope', () => {
    const session = createMemorySession();
    const purpose = {
      purpose: 'shot-plan.video-generation' as const,
      targetKind: 'project' as const,
      outputMediaKind: 'video' as const,
    };

    expect(() => createGenerationSpec({
      id: 'spec-missing-mode',
      spec: {
        purpose: 'shot-plan.video-generation',
        target: { kind: 'project', id: 'project-1' },
        authoredFrom: { kind: 'shotPlan', id: 'shot-plan-1' },
        executionKind: 'agent-external',
        values: {},
        references: [],
      },
      purpose,
      session,
      now: '2026-07-30T10:00:00.000Z',
    })).toThrow(expect.objectContaining({
      code: 'CORE_SHOT_PLAN_VIDEO_INPUT_MODE_REQUIRED',
    }));

    expect(() => createGenerationSpec({
      id: 'spec-missing-source',
      spec: {
        purpose: 'shot-plan.video-generation',
        target: { kind: 'project', id: 'project-1' },
        shotPlanVideoInputMode: 'text-only',
        executionKind: 'agent-external',
        values: {},
        references: [],
      },
      purpose,
      session,
      now: '2026-07-30T10:00:00.000Z',
    })).toThrow(expect.objectContaining({
      code: 'CORE_SHOT_PLAN_VIDEO_AUTHORED_SOURCE_REQUIRED',
    }));

    expect(() => createGenerationSpec({
      id: 'spec-forbidden-mode',
      spec: {
        purpose: 'image.create',
        target: { kind: 'project', id: 'project-1' },
        shotPlanVideoInputMode: 'text-only',
        executionKind: 'agent-external',
        values: {},
        references: [],
      },
      purpose: {
        purpose: 'image.create',
        targetKind: 'project',
        outputMediaKind: 'image',
      },
      session,
      now: '2026-07-30T10:00:00.000Z',
    })).toThrow(expect.objectContaining({
      code: 'CORE_SHOT_PLAN_VIDEO_INPUT_MODE_FORBIDDEN',
    }));
  });
});

function selection(id: string) {
  return {
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
      authored_from_shot_plan_id text,
      shot_plan_video_input_mode text,
      execution_kind text not null,
      provider text,
      model text,
      title text,
      values_json text not null,
      references_json text not null,
      frozen_at text,
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
