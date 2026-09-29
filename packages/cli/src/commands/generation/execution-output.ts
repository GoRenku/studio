import type { GenerationExecutionReport } from './execution-result.js';

export function renderGenerationExecution(report: GenerationExecutionReport): string {
  const { provenance: _provenance, ...completion } = report;
  return `Generation completed\n${JSON.stringify(completion, null, 2)}`;
}
