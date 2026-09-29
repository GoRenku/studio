import type { MediaGenerationContextReport } from '@gorenku/studio-core/client';
import { renderMedia, renderReferenceSuggestions } from './media.js';
import { renderContextValue } from './values.js';

export function renderMediaGenerationContext(report: MediaGenerationContextReport): string {
  const sections: Array<[string, string]> = [
    ['Generation', renderContextValue({ valid: report.valid, purpose: report.purpose, target: report.target, outputMediaKind: report.outputMediaKind })],
    ['Project', renderContextValue(report.project)],
    ['Workflow Policy', renderContextValue(report.workflowPolicy)],
    ['Output Guidance', renderContextValue(report.outputGuidance)],
    ['Target Context', renderContextValue(report.targetContext)],
    ['Visual Language', renderContextValue(report.visualLanguage)],
    ['Reference Suggestions', renderReferenceSuggestions(report)],
    ['Media', renderMedia(report)],
    ['Warnings', renderContextValue(report.warnings)],
    ['Resource Keys', renderContextValue(report.resourceKeys)],
  ];
  return sections.map(([heading, text]) => `## ${heading}\n${text}`).join('\n\n');
}
