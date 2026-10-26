import type { CastWardrobePlanDocument, CastWardrobeReport } from '../../../client/casting/model.js';
import { assetFileSelectionTargetKey } from '../../asset-files/selection-targets.js';
import { listCastCostumeRecords, replaceCastCostumeRecords } from '../../database/access/casting/costumes.js';
import { deleteCastingRoundRecordsForCostume, listCastingRoundRecords } from '../../database/access/casting/rounds.js';
import { listCastLookRecords } from '../../database/access/casting/looks.js';
import { readProjectRecord } from '../../database/access/project.js';
import { clearSelectedAssetFileRecord, readSelectedAssetFileRecord } from '../../database/access/selected-asset-files.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { createRandomIdGenerator } from '../../entity-ids.js';
import { withProject } from '../../project-operation.js';
import { assertCastWardrobePlanShape } from '../documents.js';
import { throwCastingIssues } from '../diagnostics.js';
import { requireCastMember } from '../looks/commands.js';
import type { CastingCastMemberInput, CastingDocumentInput } from '../../project-data-service-contracts.js';
import { readSceneOrder, toCastCostume } from '../projection.js';
import { castingReportBase } from '../report.js';
import { castWardrobePlanIssues } from './validate.js';

export async function showCastWardrobe(input: CastingCastMemberInput): Promise<CastWardrobeReport> {
  return withProject(input, ({ session }) => {
    requireCastMember(session, input.castMemberId);
    return wardrobeReport(session, input.castMemberId, [], []);
  });
}

export async function validateCastWardrobePlan(input: CastingDocumentInput): Promise<CastWardrobeReport> {
  return withProject(input, ({ session }) => {
    const document = assertPlan(session, input);
    return wardrobeReport(session, document.castMemberId, [], []);
  });
}

/**
 * Replaces the costumes. A removed costume's pick is cleared and its sheet rounds are deleted;
 * the sheets stay in the Cast Member's Assets.
 */
export async function writeCastWardrobePlan(input: CastingDocumentInput): Promise<CastWardrobeReport> {
  return withProject(input, ({ session }) => {
    const document = assertPlan(session, input);
    const idGenerator = input.idGenerator ?? createRandomIdGenerator();
    const now = new Date().toISOString();
    const kept = new Set(document.costumes.flatMap((costume) => costume.id ? [costume.id] : []));
    const removed = listCastCostumeRecords(session, document.castMemberId).filter((costume) => !kept.has(costume.id));
    const cleared: string[] = [];
    const released: string[] = [];
    session.db.transaction((tx) => {
      const txSession = { ...session, db: tx };
      removed.forEach((costume) => {
        const key = assetFileSelectionTargetKey({ kind: 'castCostume', id: costume.id });
        if (readSelectedAssetFileRecord(txSession, key)) {
          clearSelectedAssetFileRecord(txSession, key);
          cleared.push(costume.id);
        }
        released.push(...deleteCastingRoundRecordsForCostume(txSession, costume.id));
      });
      replaceCastCostumeRecords(txSession, {
        castMemberId: document.castMemberId,
        now,
        costumes: document.costumes.map((costume, position) => ({
          id: costume.id ?? idGenerator.next('cast_costume'),
          castMemberId: document.castMemberId,
          lookId: costume.lookId,
          name: costume.name.trim(),
          wardrobe: costume.wardrobe,
          continuityNotes: costume.continuityNotes,
          position,
          sceneIds: costume.sceneIds,
        })),
      });
    });
    return wardrobeReport(session, document.castMemberId, cleared, released);
  });
}

function assertPlan(session: DatabaseSession, input: CastingDocumentInput): CastWardrobePlanDocument {
  assertCastWardrobePlanShape(input.document, input.filePath);
  const document = input.document;
  requireCastMember(session, document.castMemberId);
  const existing = listCastCostumeRecords(session, document.castMemberId);
  const issues = castWardrobePlanIssues(document, {
    sceneIds: new Set(readSceneOrder(session).keys()),
    existingCostumeIds: new Set(existing.map((costume) => costume.id)),
    sheetRoundCostumeLooks: new Map(existing
      .filter((costume) => listCastingRoundRecords(session, { kind: 'castCostume', id: costume.id }).length > 0)
      .map((costume) => [costume.id, costume.lookId])),
    lookScenes: new Map(listCastLookRecords(session, document.castMemberId).map((look) => [look.id, new Set(look.sceneIds)])),
  });
  if (issues.length > 0) {
    throwCastingIssues(issues);
  }
  return document;
}

function wardrobeReport(
  session: DatabaseSession,
  castMemberId: string,
  clearedSheetSelections: string[],
  releasedSheetAssetFileIds: string[],
): CastWardrobeReport {
  const sceneOrder = readSceneOrder(session);
  return {
    ...castingReportBase(readProjectRecord(session), castMemberId),
    castMemberId,
    costumes: listCastCostumeRecords(session, castMemberId).map((record) => toCastCostume(session, record, sceneOrder)),
    clearedSheetSelections,
    releasedSheetAssetFileIds,
  };
}
