import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export interface ProjectDataError {
  code: string;
  message: string;
  issues?: DiagnosticIssue[];
  suggestion?: string;
}

export type ProjectDataErrorContract = ProjectDataError;
