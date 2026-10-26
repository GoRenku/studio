import type { CastLooksPlanDocument, CastLooksReport } from '../../../client/casting/model.js';
import { countCastCostumeRecordsForLook, listCastCostumeRecords } from '../../database/access/casting/costumes.js';
import { listCastLookRecords, replaceCastLookRecords } from '../../database/access/casting/looks.js';
import { listCastingRoundRecords } from '../../database/access/casting/rounds.js';
import { readCastMemberRecord } from '../../database/access/cast-members.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { createRandomIdGenerator } from '../../entity-ids.js';
import type { CastingCastMemberInput, CastingDocumentInput } from '../../project-data-service-contracts.js';
import { withProject } from '../../project-operation.js';
import { readProjectRecord } from '../../database/access/project.js';
import { assertCastLooksPlanShape } from '../documents.js';
import { castMemberNotFound, throwCastingIssues } from '../diagnostics.js';
import { readSceneOrder, toCastLook } from '../projection.js';
import { castingReportBase } from '../report.js';
import { castLooksPlanIssues } from './validate.js';

export async function showCastLooks(input: CastingCastMemberInput): Promise<CastLooksReport> {
  return withProject(input, ({ session }) => {
    requireCastMember(session, input.castMemberId);
    return lookReport(session, input.castMemberId);
  });
}

export async function validateCastLooksPlan(input: CastingDocumentInput): Promise<CastLooksReport> {
  return withProject(input, ({ session }) => {
    const document = assertPlan(session, input);
    return lookReport(session, document.castMemberId);
  });
}

export async function writeCastLooksPlan(input: CastingDocumentInput): Promise<CastLooksReport> {
  return withProject(input, ({ session }) => {
    const document = assertPlan(session, input);
    const idGenerator = input.idGenerator ?? createRandomIdGenerator();
    const now = new Date().toISOString();
    session.db.transaction((tx) => {
      replaceCastLookRecords({ ...session, db: tx }, {
        castMemberId: document.castMemberId,
        now,
        looks: document.looks.map((look, position) => ({
          id: look.id ?? idGenerator.next('cast_look'),
          castMemberId: document.castMemberId,
          name: look.name.trim(),
          description: look.description?.trim() ?? null,
          position,
          sceneIds: look.sceneIds,
        })),
      });
    });
    return lookReport(session, document.castMemberId);
  });
}

function assertPlan(session: DatabaseSession, input: CastingDocumentInput): CastLooksPlanDocument {
  assertCastLooksPlanShape(input.document, input.filePath);
  const document = input.document;
  requireCastMember(session, document.castMemberId);
  const existing = listCastLookRecords(session, document.castMemberId);
  const issues = castLooksPlanIssues(document, {
    sceneIds: new Set(readSceneOrder(session).keys()),
    existingLookIds: new Set(existing.map((look) => look.id)),
    lookDependencies: new Map(existing.map((look) => [look.id, lookDependencies(session, look.id)])),
    costumeScenesByLook: costumeScenesByLook(session, document.castMemberId),
  });
  if (issues.length > 0) {
    throwCastingIssues(issues);
  }
  return document;
}

function costumeScenesByLook(session: DatabaseSession, castMemberId: string): Map<string, Set<string>> {
  const scenes = new Map<string, Set<string>>();
  listCastCostumeRecords(session, castMemberId).forEach((costume) => {
    scenes.set(costume.lookId, new Set([...(scenes.get(costume.lookId) ?? []), ...costume.sceneIds]));
  });
  return scenes;
}

function lookDependencies(session: DatabaseSession, lookId: string): string[] {
  const costumes = countCastCostumeRecordsForLook(session, lookId);
  const rounds = listCastingRoundRecords(session, { kind: 'castLook', id: lookId }).length;
  return [
    ...(costumes > 0 ? [`${costumes} costume${costumes === 1 ? '' : 's'}`] : []),
    ...(rounds > 0 ? [`${rounds} casting round${rounds === 1 ? '' : 's'}`] : []),
  ];
}

function lookReport(session: DatabaseSession, castMemberId: string): CastLooksReport {
  const sceneOrder = readSceneOrder(session);
  return {
    ...castingReportBase(readProjectRecord(session), castMemberId),
    castMemberId,
    looks: listCastLookRecords(session, castMemberId).map((record) => toCastLook(session, record, sceneOrder)),
  };
}

export function requireCastMember(session: DatabaseSession, castMemberId: string): void {
  if (!readCastMemberRecord(session, castMemberId)) {
    throw castMemberNotFound(castMemberId);
  }
}
