import Ajv2020, { type ErrorObject } from 'ajv/dist/2020.js';
import {
  buildDiagnosticResult,
  createDiagnosticError,
  throwIfDiagnosticResultInvalid,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import {
  characterArcSchema,
  characterArcsWriteDocumentSchema,
  storedCharacterArcSchema,
} from '../../client/character-arcs/schemas.js';
import type { CharacterArc, CharacterArcsWriteDocument } from '../../client/character-arcs/model.js';
import { ProjectDataError } from '../project-data-error.js';

const INVALID = 'CHARACTER_ARC_INVALID';
const STORED_INVALID = 'CHARACTER_ARC_STORED_INVALID';
const CHARACTER_SHEET = 'character_sheet';

let cachedAjv: Ajv2020 | undefined;

function getAjv(): Ajv2020 {
  if (cachedAjv) {
    return cachedAjv;
  }
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    removeAdditional: false,
    useDefaults: false,
    coerceTypes: false,
  });
  ajv.addSchema(characterArcSchema);
  ajv.addSchema(characterArcsWriteDocumentSchema);
  ajv.addSchema(storedCharacterArcSchema);
  cachedAjv = ajv;
  return ajv;
}

/** Project facts the semantic checks need; gathered by the caller in one session. */
export interface CharacterArcValidationContext {
  castMemberIds: ReadonlySet<string>;
  /** Scene id to its position in the current screenplay. */
  sceneOrder: ReadonlyMap<string, number>;
  /** Available asset files by id, with their owner key and type. */
  assetFiles: ReadonlyMap<string, { ownerKey: string; type: string }>;
}

export function parseCharacterArcsJson(input: { contents: string; filePath?: string }): CharacterArcsWriteDocument {
  let value: unknown;
  try {
    value = JSON.parse(input.contents);
  } catch {
    throwInvalid([issue('Input must be a valid JSON object.', [], input.filePath)]);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throwInvalid([issue('Input must be a valid JSON object.', [], input.filePath)]);
  }
  return value as CharacterArcsWriteDocument;
}

export function assertCharacterArcsWriteDocument(input: {
  document: CharacterArcsWriteDocument;
  readContext: () => CharacterArcValidationContext;
  filePath?: string;
}): void {
  const shapeIssues = validateShape(characterArcsWriteDocumentSchema.$id, input.document, [], input.filePath);
  if (shapeIssues.length > 0) {
    throwInvalid(shapeIssues);
  }
  const context = input.readContext();
  const issues = SEMANTIC_CHECKS.flatMap((check) => check(input.document, context, input.filePath));
  if (issues.length > 0) {
    throwInvalid(issues);
  }
}

export function parseStoredCharacterArc(
  value: string,
  castMemberId: string
): { writtenAt: string; arc: CharacterArc } {
  const path = ['castMember', castMemberId, 'characterArc'];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throwStoredInvalid(castMemberId, [createDiagnosticError(STORED_INVALID, 'Stored character arc must be valid JSON.', { path })]);
  }
  const issues = validateShape(storedCharacterArcSchema.$id, parsed, path);
  if (issues.length > 0) {
    throwStoredInvalid(castMemberId, issues.map((entry) => ({ ...entry, code: STORED_INVALID })));
  }
  return parsed as { writtenAt: string; arc: CharacterArc };
}

type SemanticCheck = (
  document: CharacterArcsWriteDocument,
  context: CharacterArcValidationContext,
  filePath?: string
) => DiagnosticIssue[];

const SEMANTIC_CHECKS: SemanticCheck[] = [
  checkCastMembers,
  checkSpineForArcType,
  checkSceneReferences,
  checkCharacterSheets,
];

function checkCastMembers(document: CharacterArcsWriteDocument, context: CharacterArcValidationContext, filePath?: string): DiagnosticIssue[] {
  const seen = new Set<string>();
  return document.arcs.flatMap((entry, index) => {
    const path = ['arcs', String(index), 'castMemberId'];
    const issues: DiagnosticIssue[] = [];
    if (!context.castMemberIds.has(entry.castMemberId)) {
      issues.push(issue(`Unknown Cast Member id: ${entry.castMemberId}.`, path, filePath));
    }
    if (seen.has(entry.castMemberId)) {
      issues.push(issue(`Cast Member ${entry.castMemberId} has more than one arc.`, path, filePath));
    }
    seen.add(entry.castMemberId);
    return issues;
  });
}

function checkSpineForArcType(document: CharacterArcsWriteDocument, _context: CharacterArcValidationContext, filePath?: string): DiagnosticIssue[] {
  return document.arcs.flatMap(({ arc }, index) => {
    const path = ['arcs', String(index), 'arc', 'spine'];
    const required = arc.arcType === 'flat' ? ['truthHeld'] : ['need', 'falseBelief'];
    const forbidden = arc.arcType === 'flat' ? ['falseBelief'] : [];
    return [
      ...required
        .filter((key) => !arc.spine[key as keyof CharacterArc['spine']])
        .map((key) => issue(`A ${arc.arcType} arc needs spine.${key}.`, [...path, key], filePath)),
      ...forbidden
        .filter((key) => arc.spine[key as keyof CharacterArc['spine']])
        .map((key) => issue(`A flat arc holds a truth; it has no spine.${key}.`, [...path, key], filePath)),
    ];
  });
}

function checkSceneReferences(document: CharacterArcsWriteDocument, context: CharacterArcValidationContext, filePath?: string): DiagnosticIssue[] {
  return document.arcs.flatMap(({ arc }, index) => {
    const base = ['arcs', String(index), 'arc'];
    const unknown = (sceneIds: string[], path: string[]) =>
      sceneIds
        .filter((sceneId) => !context.sceneOrder.has(sceneId))
        .map((sceneId) => issue(`Unknown Scene id: ${sceneId}.`, path, filePath));
    const spineIssues = Object.entries(arc.spine).flatMap(([key, field]) =>
      field ? unknown(field.sceneIds, [...base, 'spine', key, 'sceneIds']) : []);
    let previousFirst = -1;
    const turningPointIssues = arc.turningPoints.flatMap((turningPoint, turningIndex) => {
      const path = [...base, 'turningPoints', String(turningIndex), 'sceneIds'];
      const unknownIssues = unknown(turningPoint.sceneIds, path);
      if (unknownIssues.length > 0) {
        return unknownIssues;
      }
      const order = turningPoint.sceneIds.map((sceneId) => context.sceneOrder.get(sceneId) as number);
      const issues: DiagnosticIssue[] = [];
      if (order.some((position, at) => at > 0 && position < order[at - 1]!)) {
        issues.push(issue('Scene ids within a turning point must follow screenplay order.', path, filePath));
      }
      if (order[0]! < previousFirst) {
        issues.push(issue('Turning points must follow screenplay order by their first Scene.', path, filePath));
      }
      previousFirst = Math.max(previousFirst, order[0]!);
      return issues;
    });
    return [...spineIssues, ...turningPointIssues];
  });
}

function checkCharacterSheets(document: CharacterArcsWriteDocument, context: CharacterArcValidationContext, filePath?: string): DiagnosticIssue[] {
  return document.arcs.flatMap(({ arc, castMemberId }, index) =>
    arc.turningPoints.flatMap((turningPoint, turningIndex) => {
      if (!turningPoint.characterSheetAssetFileId) {
        return [];
      }
      const path = ['arcs', String(index), 'arc', 'turningPoints', String(turningIndex), 'characterSheetAssetFileId'];
      const asset = context.assetFiles.get(turningPoint.characterSheetAssetFileId);
      if (!asset || asset.type !== CHARACTER_SHEET) {
        return [issue(`characterSheetAssetFileId must name an available character sheet: ${turningPoint.characterSheetAssetFileId}.`, path, filePath)];
      }
      return asset.ownerKey === `castMember:${castMemberId}`
        ? []
        : [issue('The character sheet must belong to this Cast Member.', path, filePath)];
    }));
}

function validateShape(schemaId: string, value: unknown, basePath: string[], filePath?: string): DiagnosticIssue[] {
  const validator = getAjv().getSchema(schemaId);
  if (!validator) {
    return [issue('Character arc schema is unavailable.', basePath, filePath)];
  }
  return validator(value) ? [] : mapAjvErrors(validator.errors ?? [], basePath, filePath);
}

function mapAjvErrors(errors: ErrorObject[], basePath: string[], filePath?: string): DiagnosticIssue[] {
  return errors
    .map((error) => {
      const path = [...basePath, ...error.instancePath.split('/').slice(1)];
      if (error.keyword === 'required') {
        path.push(String(error.params.missingProperty));
      }
      if (error.keyword === 'additionalProperties') {
        path.push(String(error.params.additionalProperty));
      }
      return issue(`Invalid character arc value at ${path.join('.') || '<root>'}: ${error.message ?? error.keyword}.`, path, filePath);
    });
}

function issue(message: string, path: string[], filePath?: string): DiagnosticIssue {
  return createDiagnosticError(
    INVALID,
    message,
    { path, ...(filePath ? { filePath } : {}) },
    'Print the contract with `renku cast arc schema` and use current Cast Member, Scene and character sheet ids.'
  );
}

function throwInvalid(issues: DiagnosticIssue[]): never {
  throwIfDiagnosticResultInvalid(buildDiagnosticResult(issues), {
    code: INVALID,
    message: 'Character arcs failed validation.',
    suggestion: 'Fix the reported issues and run the command again.',
  });
  throw new Error('unreachable');
}

function throwStoredInvalid(castMemberId: string, issues: DiagnosticIssue[]): never {
  throw new ProjectDataError(
    STORED_INVALID,
    `Stored character arc for ${castMemberId} does not match the character arc contract.`,
    { issues, suggestion: 'Rewrite the arcs with `renku cast arc write`.' }
  );
}
