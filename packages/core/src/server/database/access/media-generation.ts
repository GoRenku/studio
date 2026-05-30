import { desc, eq, and } from 'drizzle-orm';
import type {
  MediaGenerationPurpose,
  MediaGenerationRun,
  MediaGenerationSpec,
  MediaGenerationSpecRecord,
} from '../../../client/index.js';
import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
} from '../../../client/index.js';
import { mediaGenerationRuns, mediaGenerationSpecs } from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export type MediaGenerationSpecRow = typeof mediaGenerationSpecs.$inferSelect;
export type MediaGenerationRunRow = typeof mediaGenerationRuns.$inferSelect;

export function insertMediaGenerationSpec(
  session: DatabaseSession,
  input: {
    id: string;
    spec: MediaGenerationSpec;
    title: string;
    now: string;
  }
): MediaGenerationSpecRecord {
  session.db
    .insert(mediaGenerationSpecs)
    .values({
      id: input.id,
      purpose: input.spec.purpose,
      targetKind: input.spec.target.kind,
      targetId: input.spec.target.id,
      modelChoice: input.spec.modelChoice,
      title: input.title,
      specJson: JSON.stringify(input.spec),
      createdAt: input.now,
      updatedAt: input.now,
    })
    .run();
  return requireMediaGenerationSpec(session, input.id);
}

export function updateMediaGenerationSpec(
  session: DatabaseSession,
  input: {
    id: string;
    spec: MediaGenerationSpec;
    title: string;
    now: string;
  }
): MediaGenerationSpecRecord {
  requireMediaGenerationSpec(session, input.id);
  session.db
    .update(mediaGenerationSpecs)
    .set({
      purpose: input.spec.purpose,
      targetKind: input.spec.target.kind,
      targetId: input.spec.target.id,
      modelChoice: input.spec.modelChoice,
      title: input.title,
      specJson: JSON.stringify(input.spec),
      updatedAt: input.now,
    })
    .where(eq(mediaGenerationSpecs.id, input.id))
    .run();
  return requireMediaGenerationSpec(session, input.id);
}

export function readMediaGenerationSpec(
  session: DatabaseSession,
  id: string
): MediaGenerationSpecRecord | null {
  const row =
    session.db
      .select()
      .from(mediaGenerationSpecs)
      .where(eq(mediaGenerationSpecs.id, id))
      .get() ?? null;
  return row ? toSpecRecord(row) : null;
}

export function requireMediaGenerationSpec(
  session: DatabaseSession,
  id: string
): MediaGenerationSpecRecord {
  const record = readMediaGenerationSpec(session, id);
  if (!record) {
    throw new ProjectDataError(
      'PROJECT_DATA260',
      `Media generation spec was not found: ${id}.`
    );
  }
  return record;
}

export function listMediaGenerationSpecs(
  session: DatabaseSession,
  input: {
    purpose: MediaGenerationPurpose;
    targetKind: 'lookbook' | 'castMember' | 'location' | 'scene';
    targetId: string;
  }
): MediaGenerationSpecRecord[] {
  return session.db
    .select()
    .from(mediaGenerationSpecs)
    .where(
      and(
        eq(mediaGenerationSpecs.purpose, input.purpose),
        eq(mediaGenerationSpecs.targetKind, input.targetKind),
        eq(mediaGenerationSpecs.targetId, input.targetId)
      )
    )
    .orderBy(desc(mediaGenerationSpecs.updatedAt), desc(mediaGenerationSpecs.id))
    .all()
    .map(toSpecRecord);
}

export function insertMediaGenerationRun(
  session: DatabaseSession,
  input: {
    id: string;
    specId: string;
    spec: MediaGenerationSpec;
    provider: 'fal-ai';
    model: string;
    providerPayload: Record<string, unknown>;
    estimate: unknown;
    approvalToken?: string;
    simulated: boolean;
    status: MediaGenerationRun['status'];
    outputs: unknown;
    diagnostics: unknown;
    startedAt: string;
    completedAt?: string | null;
  }
): MediaGenerationRun {
  session.db
    .insert(mediaGenerationRuns)
    .values({
      id: input.id,
      specId: input.specId,
      purpose: input.spec.purpose,
      targetKind: input.spec.target.kind,
      targetId: input.spec.target.id,
      modelChoice: input.spec.modelChoice,
      specSnapshotJson: JSON.stringify(input.spec),
      provider: input.provider,
      model: input.model,
      providerPayloadJson: JSON.stringify(input.providerPayload),
      estimateSnapshotJson: JSON.stringify(input.estimate),
      approvalToken: input.approvalToken,
      simulated: input.simulated,
      status: input.status,
      outputsJson: JSON.stringify(input.outputs),
      diagnosticsJson: JSON.stringify(input.diagnostics),
      startedAt: input.startedAt,
      completedAt: input.completedAt ?? null,
    })
    .run();
  return requireMediaGenerationRun(session, input.id);
}

export function requireMediaGenerationRun(
  session: DatabaseSession,
  id: string
): MediaGenerationRun {
  const row =
    session.db
      .select()
      .from(mediaGenerationRuns)
      .where(eq(mediaGenerationRuns.id, id))
      .get() ?? null;
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA261',
      `Media generation run was not found: ${id}.`
    );
  }
  return toRunRecord(row);
}

function toSpecRecord(row: MediaGenerationSpecRow): MediaGenerationSpecRecord {
  const spec = JSON.parse(row.specJson) as MediaGenerationSpec;
  assertMediaGenerationPurpose(spec.purpose);
  return {
    id: row.id,
    purpose: spec.purpose,
    target: spec.target,
    modelChoice: spec.modelChoice,
    title: row.title,
    spec,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRunRecord(row: MediaGenerationRunRow): MediaGenerationRun {
  const spec = JSON.parse(row.specSnapshotJson) as MediaGenerationSpec;
  assertMediaGenerationPurpose(spec.purpose);
  return {
    id: row.id,
    specId: row.specId,
    purpose: spec.purpose,
    target: spec.target,
    modelChoice: spec.modelChoice,
    provider: 'fal-ai',
    model: row.model,
    specSnapshot: spec,
    providerPayload: JSON.parse(row.providerPayloadJson) as Record<string, unknown>,
    estimateSnapshot: JSON.parse(row.estimateSnapshotJson) as unknown,
    ...(row.approvalToken ? { approvalToken: row.approvalToken } : {}),
    simulated: row.simulated,
    status: row.status as MediaGenerationRun['status'],
    outputs: JSON.parse(row.outputsJson) as unknown,
    diagnostics: JSON.parse(row.diagnosticsJson) as unknown,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

function assertMediaGenerationPurpose(
  purpose: string
): asserts purpose is MediaGenerationPurpose {
  if (
    purpose !== LOOKBOOK_IMAGE_GENERATION_PURPOSE &&
    purpose !== CAST_CHARACTER_SHEET_GENERATION_PURPOSE &&
    purpose !== CAST_PROFILE_GENERATION_PURPOSE &&
    purpose !== LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE &&
    purpose !== SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE
  ) {
    throw new ProjectDataError(
      'PROJECT_DATA262',
      `Unsupported media generation spec purpose: ${purpose}.`
    );
  }
}
