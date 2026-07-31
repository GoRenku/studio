import { and, desc, eq, isNull, type SQL } from 'drizzle-orm';
import type {
  GenerationRun,
  GenerationSpec,
  GenerationSpecAuthoredFrom,
  GenerationSpecRecord,
  GenerationTarget,
  JsonValue,
} from '../../../client/generation.js';
import { isGenerationPurpose } from '../../generation/purposes.js';
import { mediaGenerationRuns, mediaGenerationSpecs } from '../../schema/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export function insertGenerationSpecRecord(
  session: DatabaseSession,
  record: GenerationSpecRecord
): GenerationSpecRecord {
  session.db.insert(mediaGenerationSpecs).values(toSpecRow(record)).run();
  return record;
}

export function updateGenerationSpecRecord(
  session: DatabaseSession,
  record: GenerationSpecRecord
): GenerationSpecRecord {
  const row = toSpecRow(record);
  session.db
    .update(mediaGenerationSpecs)
    .set({
      purpose: row.purpose,
      targetKind: row.targetKind,
      targetId: row.targetId,
      authoredFromShotPlanId: row.authoredFromShotPlanId,
      shotPlanVideoInputMode: row.shotPlanVideoInputMode,
      executionKind: row.executionKind,
      provider: row.provider,
      model: row.model,
      title: row.title,
      valuesJson: row.valuesJson,
      referencesJson: row.referencesJson,
      updatedAt: row.updatedAt,
    })
    .where(eq(mediaGenerationSpecs.id, record.id))
    .run();
  return record;
}

export function freezeGenerationSpecRecord(
  session: DatabaseSession,
  input: { record: GenerationSpecRecord; frozenAt: string }
): boolean {
  const expected = toSpecRow(input.record);
  const result = session.db
    .update(mediaGenerationSpecs)
    .set({ frozenAt: input.frozenAt })
    .where(and(
      eq(mediaGenerationSpecs.id, input.record.id),
      eq(mediaGenerationSpecs.purpose, expected.purpose),
      eq(mediaGenerationSpecs.targetKind, expected.targetKind),
      eq(mediaGenerationSpecs.targetId, expected.targetId),
      nullableEquality(
        mediaGenerationSpecs.authoredFromShotPlanId,
        expected.authoredFromShotPlanId
      ),
      nullableEquality(
        mediaGenerationSpecs.shotPlanVideoInputMode,
        expected.shotPlanVideoInputMode
      ),
      eq(mediaGenerationSpecs.executionKind, expected.executionKind),
      nullableEquality(mediaGenerationSpecs.provider, expected.provider),
      nullableEquality(mediaGenerationSpecs.model, expected.model),
      nullableEquality(mediaGenerationSpecs.title, expected.title),
      eq(mediaGenerationSpecs.valuesJson, expected.valuesJson),
      eq(mediaGenerationSpecs.referencesJson, expected.referencesJson),
      eq(mediaGenerationSpecs.updatedAt, expected.updatedAt),
      isNull(mediaGenerationSpecs.frozenAt)
    ))
    .run();
  return result.changes === 1;
}

function nullableEquality(column: Parameters<typeof eq>[0], value: string | null): SQL {
  return value === null ? isNull(column) : eq(column, value);
}

export function readGenerationSpecRecord(
  session: DatabaseSession,
  id: string
): GenerationSpecRecord | null {
  const row = session.db
    .select()
    .from(mediaGenerationSpecs)
    .where(eq(mediaGenerationSpecs.id, id))
    .get();
  return row ? toSpecRecord(row) : null;
}

export function listGenerationSpecRecords(
  session: DatabaseSession,
  input: {
    purpose?: string;
    target?: GenerationTarget;
    authoredFrom?: GenerationSpecAuthoredFrom;
  }
): GenerationSpecRecord[] {
  const conditions = [];
  if (input.purpose) {
    conditions.push(eq(mediaGenerationSpecs.purpose, input.purpose));
  }
  if (input.target) {
    conditions.push(
      eq(mediaGenerationSpecs.targetKind, input.target.kind),
      eq(mediaGenerationSpecs.targetId, generationTargetId(input.target))
    );
  }
  if (input.authoredFrom) {
    conditions.push(
      eq(mediaGenerationSpecs.authoredFromShotPlanId, input.authoredFrom.id)
    );
  }
  return session.db
    .select()
    .from(mediaGenerationSpecs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(mediaGenerationSpecs.updatedAt), desc(mediaGenerationSpecs.id))
    .all()
    .map(toSpecRecord);
}

export function insertGenerationRunRecord(
  session: DatabaseSession,
  run: GenerationRun
): GenerationRun {
  session.db.insert(mediaGenerationRuns).values({
    id: run.id,
    specId: run.specId,
    purpose: run.specSnapshot.purpose,
    targetKind: run.specSnapshot.target.kind,
    targetId: generationTargetId(run.specSnapshot.target),
    provider: run.provider,
    model: run.model,
    specSnapshotJson: JSON.stringify(run.specSnapshot),
    providerPayloadJson: JSON.stringify(run.providerPayload),
    estimateJson: JSON.stringify(run.estimate),
    approvalToken: run.estimate.approvalToken,
    status: run.status,
    outputsJson: JSON.stringify(run.outputs),
    receiptJson: run.receipt === null ? null : JSON.stringify(run.receipt),
    diagnosticsJson: JSON.stringify(run.diagnostics),
    startedAt: run.startedAt,
    completedAt: run.completedAt,
  }).run();
  return run;
}

export function readGenerationRunRecord(
  session: DatabaseSession,
  id: string
): GenerationRun | null {
  const row = session.db
    .select()
    .from(mediaGenerationRuns)
    .where(eq(mediaGenerationRuns.id, id))
    .get();
  if (!row) {
    return null;
  }
  const specSnapshot = JSON.parse(row.specSnapshotJson) as GenerationSpec;
  return {
    id: row.id,
    specId: row.specId,
    specSnapshot: {
      ...specSnapshot,
      executionKind: 'renku-managed',
    },
    provider: row.provider,
    model: row.model,
    providerPayload: JSON.parse(row.providerPayloadJson) as Record<string, JsonValue>,
    estimate: JSON.parse(row.estimateJson) as GenerationRun['estimate'],
    status: row.status as GenerationRun['status'],
    outputs: JSON.parse(row.outputsJson) as GenerationRun['outputs'],
    receipt: row.receiptJson === null
      ? null
      : JSON.parse(row.receiptJson) as JsonValue,
    diagnostics: JSON.parse(row.diagnosticsJson) as GenerationRun['diagnostics'],
    startedAt: row.startedAt,
    completedAt: row.completedAt,
  };
}

export function listGenerationRunRecords(
  session: DatabaseSession,
  input: { specId?: string; purpose?: string; target?: GenerationTarget }
): GenerationRun[] {
  const conditions = [];
  if (input.specId) {
    conditions.push(eq(mediaGenerationRuns.specId, input.specId));
  }
  if (input.purpose) {
    conditions.push(eq(mediaGenerationRuns.purpose, input.purpose));
  }
  if (input.target) {
    conditions.push(
      eq(mediaGenerationRuns.targetKind, input.target.kind),
      eq(mediaGenerationRuns.targetId, generationTargetId(input.target))
    );
  }
  return session.db
    .select()
    .from(mediaGenerationRuns)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(mediaGenerationRuns.startedAt), desc(mediaGenerationRuns.id))
    .all()
    .map((row) => readGenerationRunRecord(session, row.id)!)
}

function toSpecRow(record: GenerationSpecRecord) {
  return {
    id: record.id,
    purpose: record.spec.purpose,
    targetKind: record.spec.target.kind,
    targetId: generationTargetId(record.spec.target),
    authoredFromShotPlanId: record.spec.authoredFrom?.id ?? null,
    shotPlanVideoInputMode: record.spec.shotPlanVideoInputMode ?? null,
    executionKind: record.spec.executionKind,
    provider: record.spec.model?.provider ?? null,
    model: record.spec.model?.model ?? null,
    title: record.spec.title ?? null,
    valuesJson: JSON.stringify(record.spec.values),
    referencesJson: JSON.stringify(record.spec.references),
    frozenAt: record.frozenAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toSpecRecord(
  row: typeof mediaGenerationSpecs.$inferSelect
): GenerationSpecRecord {
  if (!isGenerationPurpose(row.purpose)) {
    throw new Error(`Stored generation purpose is not supported: ${row.purpose}.`);
  }
  return {
    id: row.id,
    spec: {
      purpose: row.purpose,
      target: generationTarget(row.targetKind, row.targetId),
      ...generationSpecAuthoredFrom(row.authoredFromShotPlanId),
      ...generationSpecShotPlanVideoInputMode(row.shotPlanVideoInputMode),
      executionKind: row.executionKind as GenerationSpec['executionKind'],
      ...(row.provider !== null || row.model !== null
        ? {
            model: {
              ...(row.provider !== null ? { provider: row.provider } : {}),
              ...(row.model !== null ? { model: row.model } : {}),
            },
          }
        : {}),
      values: JSON.parse(row.valuesJson) as GenerationSpec['values'],
      references: JSON.parse(row.referencesJson) as GenerationSpec['references'],
      ...(row.title !== null ? { title: row.title } : {}),
    },
    frozenAt: row.frozenAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function generationTarget(kind: string, id: string): GenerationTarget {
  if (
    kind === 'project' ||
    kind === 'asset' ||
    kind === 'lookbook' ||
    kind === 'castMember' ||
    kind === 'location' ||
    kind === 'prop' ||
    kind === 'scene' ||
    kind === 'shot' ||
    kind === 'sceneDialogue'
  ) {
    return { kind, id };
  }
  throw new ProjectDataError(
    'CORE_GENERATION_TARGET_INVALID',
    `Unsupported generation target kind in current database: ${kind}.`
  );
}

function generationTargetId(target: GenerationTarget): string {
  return target.id;
}

function generationSpecAuthoredFrom(
  shotPlanId: string | null
): { authoredFrom?: GenerationSpecAuthoredFrom } {
  if (shotPlanId === null) {
    return {};
  }
  if (shotPlanId.trim()) {
    return { authoredFrom: { kind: 'shotPlan', id: shotPlanId } };
  }
  throw new ProjectDataError(
    'CORE_GENERATION_SPEC_INVALID',
    'Stored generation authored-from context is invalid.'
  );
}

function generationSpecShotPlanVideoInputMode(
  inputMode: string | null
): Pick<GenerationSpec, 'shotPlanVideoInputMode'> | {} {
  if (inputMode === null) {
    return {};
  }
  if (
    inputMode === 'text-only' ||
    inputMode === 'first-frame' ||
    inputMode === 'first-last-frame' ||
    inputMode === 'reference'
  ) {
    return { shotPlanVideoInputMode: inputMode };
  }
  throw new ProjectDataError(
    'CORE_GENERATION_SPEC_INVALID',
    'Stored Shot Plan video input mode is invalid.'
  );
}
