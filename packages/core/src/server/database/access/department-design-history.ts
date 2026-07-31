import type { DepartmentDocumentSummary } from '../../../client/department-design.js';
import { ProjectDataError } from '../../project-data-error.js';

export interface DepartmentDesignHistoryRow {
  id: string;
  documentJson: string;
  title: string | null;
  sourceCommand: string | null;
  createdAt: string;
}

export function toDepartmentDesignSummaries(
  rows: Array<DepartmentDesignHistoryRow & { ownerId: string }>,
  activeDesignId: string | null
): DepartmentDocumentSummary[] {
  return rows.map((row) =>
    toDepartmentDesignSummary(row, row.ownerId, row.id === activeDesignId)
  );
}

export function readDepartmentDesignDocument<T>(input: {
  row: DepartmentDesignHistoryRow | undefined;
  ownerId: string;
  activeDesignId: string | null;
  label: string;
  parse(documentJson: string, path: string[]): T;
}): { id: string; document: T; summary: DepartmentDocumentSummary } {
  if (!input.row) {
    throw new ProjectDataError('PROJECT_DATA205', `${input.label} was not found.`, {
      suggestion: 'Check the id from the latest department list command.',
    });
  }
  return {
    id: input.row.id,
    document: input.parse(input.row.documentJson, [
      input.label.replaceAll(' ', ''),
      input.row.id,
    ]),
    summary: toDepartmentDesignSummary(
      input.row,
      input.ownerId,
      input.row.id === input.activeDesignId
    ),
  };
}

export function parseStoredDepartmentJson(
  documentJson: string,
  path: string[]
): unknown {
  try {
    return JSON.parse(documentJson);
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    throw new ProjectDataError(
      'PROJECT_DATA200',
      'Stored department document JSON is malformed.',
      {
        suggestion: `Repair the stored department document at ${path.join('.')}.`,
      }
    );
  }
}

function toDepartmentDesignSummary(
  row: DepartmentDesignHistoryRow,
  ownerId: string,
  isActive: boolean
): DepartmentDocumentSummary {
  return {
    id: row.id,
    ownerId,
    title: row.title,
    createdAt: row.createdAt,
    isActive,
    sourceCommand: row.sourceCommand,
  };
}
