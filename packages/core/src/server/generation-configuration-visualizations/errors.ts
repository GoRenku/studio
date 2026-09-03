import {
  StructuredError,
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';

export class GenerationConfigurationVisualizationCacheError extends StructuredError {
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
    this.name = 'GenerationConfigurationVisualizationCacheError';
  }
}

export function generationConfigurationVisualizationCacheError(
  code: string,
  message: string,
  path: string[],
  suggestion?: string
): GenerationConfigurationVisualizationCacheError {
  return new GenerationConfigurationVisualizationCacheError(code, message, {
    issues: [
      createDiagnosticError(
        code,
        message,
        { path, context: 'generation configuration visualization cache' },
        suggestion
      ),
    ],
    suggestion,
  });
}
