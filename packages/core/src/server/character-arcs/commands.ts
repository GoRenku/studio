import type {
  CharacterArcListReport,
  CharacterArcReadReport,
  CharacterArcsValidationReport,
  CharacterArcsWriteDocument,
  CharacterArcsWriteReport,
} from '../../client/character-arcs/model.js';
import { isAssetFileAvailableInSession } from '../asset-files/projection.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { ProjectDataError } from '../project-data-error.js';
import type {
  CharacterArcsProjectInput,
  ReadCharacterArcInput,
  ValidateCharacterArcsInput,
} from '../project-data-service-contracts.js';
import { castMembers } from '../schema/index.js';
import { readCanonicalScreenplay } from '../screenplay/projections/screenplay.js';
import { studioCastMemberSurfaceResourceKey } from '../studio-coordination/resource-keys.js';
import { characterArcFreshness, characterArcFreshnessHelp } from './freshness.js';
import { listStoredCharacterArcs, readStoredCharacterArc, replaceStoredCharacterArcs } from './persistence.js';
import { assertCharacterArcsWriteDocument, type CharacterArcValidationContext } from './validation.js';

const CHARACTER_ARCS_RESOURCE_KEY = 'character-arcs';

export async function validateCharacterArcs(input: ValidateCharacterArcsInput): Promise<CharacterArcsValidationReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => {
    assertDocument(session, input);
    return {
      ...reportBase(currentProject, [CHARACTER_ARCS_RESOURCE_KEY]),
      arcCount: input.document.arcs.length,
    };
  });
}

export async function writeCharacterArcs(input: ValidateCharacterArcsInput): Promise<CharacterArcsWriteReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => {
    assertDocument(session, input);
    const writtenAt = new Date().toISOString();
    let result = { written: [] as string[], cleared: [] as string[] };
    session.db.transaction((tx) => {
      result = replaceStoredCharacterArcs({ ...session, db: tx }, { arcs: input.document.arcs, writtenAt });
    });
    return {
      ...reportBase(currentProject, [
        CHARACTER_ARCS_RESOURCE_KEY,
        ...[...result.written, ...result.cleared].map(studioCastMemberSurfaceResourceKey),
      ]),
      written: result.written,
      cleared: result.cleared,
      changes: [
        ...result.written.map((castMemberId) => ({ type: 'characterArc.written' as const, castMemberId })),
        ...result.cleared.map((castMemberId) => ({ type: 'characterArc.cleared' as const, castMemberId })),
      ],
    };
  });
}

export async function listCharacterArcs(input: CharacterArcsProjectInput = {}): Promise<CharacterArcListReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => ({
    ...reportBase(currentProject, [CHARACTER_ARCS_RESOURCE_KEY]),
    arcs: listStoredCharacterArcs(session).map((record) => ({
      castMemberId: record.castMemberId,
      name: record.name,
      arcType: record.arc.arcType,
      writtenAt: record.writtenAt,
      freshness: characterArcFreshness(session, record.writtenAt),
    })),
  }));
}

export async function readCharacterArc(input: ReadCharacterArcInput): Promise<CharacterArcReadReport> {
  return withCurrentProjectSession(input, ({ currentProject, session }) => {
    const record = readStoredCharacterArc(session, input.castMemberId);
    if (!record) {
      throw new ProjectDataError('CHARACTER_ARC_NOT_FOUND', `Cast Member ${input.castMemberId} has no character arc.`, {
        suggestion: 'List the Cast Members that have arcs with `renku cast arc list`.',
      });
    }
    const freshness = characterArcFreshness(session, record.writtenAt);
    return {
      ...reportBase(currentProject, [CHARACTER_ARCS_RESOURCE_KEY, studioCastMemberSurfaceResourceKey(record.castMemberId)]),
      castMemberId: record.castMemberId,
      arc: record.arc,
      writtenAt: record.writtenAt,
      freshness,
      freshnessHelp: characterArcFreshnessHelp(freshness),
    };
  });
}

function assertDocument(session: DatabaseSession, input: { document: CharacterArcsWriteDocument; filePath?: string }): void {
  assertCharacterArcsWriteDocument({
    document: input.document,
    readContext: () => readValidationContext(session, input.document),
    ...(input.filePath ? { filePath: input.filePath } : {}),
  });
}

function readValidationContext(session: DatabaseSession, document: CharacterArcsWriteDocument): CharacterArcValidationContext {
  const characterSheetIds = new Set(
    document.arcs.flatMap((entry) =>
      entry.arc.turningPoints.flatMap((point) => point.characterSheetAssetFileId ? [point.characterSheetAssetFileId] : []))
  );
  const assetFiles = new Map<string, { ownerKey: string; type: string }>();
  for (const id of characterSheetIds) {
    const record = readAssetFileRecordIncludingDiscarded(session, id);
    if (record && isAssetFileAvailableInSession(session, record)) {
      assetFiles.set(id, { ownerKey: record.ownerKey, type: record.type });
    }
  }
  return {
    castMemberIds: new Set(session.db.select({ id: castMembers.id }).from(castMembers).all().map((row) => row.id)),
    sceneOrder: new Map(readCanonicalScreenplay(session).scenes.map((scene, index) => [scene.id, index])),
    assetFiles,
  };
}

function reportBase(project: { projectId: string; projectName: string }, resourceKeys: string[]) {
  return {
    valid: true as const,
    warnings: [],
    project: { id: project.projectId, projectName: project.projectName },
    resourceKeys,
  };
}
