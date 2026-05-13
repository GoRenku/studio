import { StructuredError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';

export class VisualLanguageCatalogError extends StructuredError {
  constructor(
    code: string,
    message: string,
    options: {
      issues?: DiagnosticIssue[];
      suggestion?: string;
    } = {}
  ) {
    super({
      code,
      message,
      issues: options.issues,
      suggestion: options.suggestion,
    });
    this.name = 'VisualLanguageCatalogError';
  }
}
