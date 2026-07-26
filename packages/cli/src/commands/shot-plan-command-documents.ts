import type {
  ShotDocument,
  ShotPlanAuthoringDocument,
  ShotPlanCreateDocument,
  ShotPlanUpdateDocument,
} from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { readJsonFile } from './structured-command.js';

export async function readShotPlanAuthoringDocument(
  filePath: string
): Promise<unknown> {
  try {
    return await readJsonFile(filePath);
  } catch {
    throw new StructuredError({
      code: 'CLI153',
      message: `Shot Plan authoring document could not be read: ${filePath}.`,
      suggestion:
        'Pass a readable JSON file using the documented tagged authoring contract.',
    });
  }
}

export function requireDocumentKind<K extends ShotPlanAuthoringDocument['kind']>(
  document: ShotPlanAuthoringDocument,
  kind: K
): Extract<ShotPlanAuthoringDocument, { kind: K }> {
  if (document.kind !== kind) {
    throw new StructuredError({
      code: 'CLI153',
      message: `Expected a ${kind} document, received ${document.kind}.`,
    });
  }
  return document as Extract<ShotPlanAuthoringDocument, { kind: K }>;
}

export type {
  ShotDocument,
  ShotPlanCreateDocument,
  ShotPlanUpdateDocument,
};
