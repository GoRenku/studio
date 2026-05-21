import { ProjectDataError } from '../../../project-data-error.js';
import type { DatabaseSession } from '../../lifecycle/store.js';

export interface ContinuityReferenceAssetRecord {
  id: string;
  continuityReferenceId: string;
  assetId: string;
  localeId: string | null;
  role: string;
  sortOrder: number;
  selection: string;
  selectionOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface InsertContinuityReferenceAssetRecord {
  id: string;
  continuityReferenceId: string;
  assetId: string;
  localeId?: string | null;
  role: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function insertContinuityReferenceAssetRecord(
  session: DatabaseSession,
  record: InsertContinuityReferenceAssetRecord
): void {
  void session;
  void record;
  throw new ProjectDataError(
    'PROJECT_DATA207',
    'Continuity reference assets are not part of the current screenplay data model.'
  );
}

export function listContinuityReferenceAssetRecords(
  session: DatabaseSession
): ContinuityReferenceAssetRecord[] {
  void session;
  return [];
}
