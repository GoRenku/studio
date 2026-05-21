import type { DatabaseSession } from '../lifecycle/store.js';

export interface ContinuityReferenceRecord {
  id: string;
  kind: string;
  name: string;
  oneLineSummary: string | null;
  position: number;
}

export interface InsertContinuityReferenceRecord {
  id: string;
  kind: string;
  name: string;
  oneLineSummary?: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export function insertContinuityReferenceRecords(
  session: DatabaseSession,
  records: InsertContinuityReferenceRecord[]
): void {
  void session;
  void records;
}

export function listContinuityReferenceRecords(
  session: DatabaseSession
): ContinuityReferenceRecord[] {
  void session;
  return [];
}
