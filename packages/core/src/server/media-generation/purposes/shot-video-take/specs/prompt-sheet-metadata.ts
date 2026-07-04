import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import {
  SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE,
  type ShotVideoTakeInputGenerationPurpose,
  type ShotVideoTakeInputGenerationSpec,
  type VideoPromptSheetNotationModeId,
  type VideoPromptSheetVisualStyleId,
} from '../../../../../client/index.js';
import { ProjectDataError } from '../../../../project-data-error.js';

export interface ShotVideoPromptSheetMetadataSource {
  purpose: ShotVideoTakeInputGenerationPurpose;
  promptSheetVisualStyleId?: VideoPromptSheetVisualStyleId;
  promptSheetNotationModeId?: VideoPromptSheetNotationModeId;
}

export function promptSheetMetadataForShotInputSpec(
  source: ShotVideoPromptSheetMetadataSource
): Pick<
  ShotVideoTakeInputGenerationSpec,
  'promptSheetVisualStyleId' | 'promptSheetNotationModeId'
> | Record<string, never> {
  if (source.purpose !== SHOT_VIDEO_PROMPT_SHEET_GENERATION_PURPOSE) {
    return {};
  }
  return {
    promptSheetVisualStyleId: source.promptSheetVisualStyleId,
    promptSheetNotationModeId: source.promptSheetNotationModeId,
  };
}

export function validateVideoPromptSheetMetadata(
  spec: ShotVideoTakeInputGenerationSpec
): void {
  const issues: ReturnType<typeof createDiagnosticError>[] = [];
  if (!isVideoPromptSheetVisualStyleId(spec.promptSheetVisualStyleId)) {
    issues.push(
      createDiagnosticError(
        'CORE_VIDEO_PROMPT_SHEET_VISUAL_STYLE_INVALID',
        'shot.video-prompt-sheet requires a supported promptSheetVisualStyleId.',
        { path: ['promptSheetVisualStyleId'], context: 'Shot video take input spec' },
        'Use cinematic-realistic or handdrawn-storyboard.'
      )
    );
  }
  if (!isVideoPromptSheetNotationModeId(spec.promptSheetNotationModeId)) {
    issues.push(
      createDiagnosticError(
        'CORE_VIDEO_PROMPT_SHEET_NOTATION_MODE_INVALID',
        'shot.video-prompt-sheet requires a supported promptSheetNotationModeId.',
        { path: ['promptSheetNotationModeId'], context: 'Shot video take input spec' },
        'Use none or motion-annotation.'
      )
    );
  }
  if (issues.length > 0) {
    throw new ProjectDataError(
      'CORE_VIDEO_PROMPT_SHEET_METADATA_INVALID',
      'Video prompt sheet metadata failed validation.',
      {
        issues,
        suggestion:
          'Provide promptSheetVisualStyleId and promptSheetNotationModeId for shot.video-prompt-sheet specs.',
      }
    );
  }
}

export function validatePromptSheetMetadataAbsent(
  spec: ShotVideoTakeInputGenerationSpec
): void {
  const issues: ReturnType<typeof createDiagnosticError>[] = [];
  if (spec.promptSheetVisualStyleId !== undefined) {
    issues.push(
      createDiagnosticError(
        'CORE_VIDEO_PROMPT_SHEET_VISUAL_STYLE_FORBIDDEN',
        'promptSheetVisualStyleId is only valid for shot.video-prompt-sheet specs.',
        { path: ['promptSheetVisualStyleId'], context: 'Shot video take input spec' },
        'Remove promptSheetVisualStyleId from first-frame, last-frame, and reference-image specs.'
      )
    );
  }
  if (spec.promptSheetNotationModeId !== undefined) {
    issues.push(
      createDiagnosticError(
        'CORE_VIDEO_PROMPT_SHEET_NOTATION_MODE_FORBIDDEN',
        'promptSheetNotationModeId is only valid for shot.video-prompt-sheet specs.',
        { path: ['promptSheetNotationModeId'], context: 'Shot video take input spec' },
        'Remove promptSheetNotationModeId from first-frame, last-frame, and reference-image specs.'
      )
    );
  }
  if (issues.length > 0) {
    throw new ProjectDataError(
      'CORE_VIDEO_PROMPT_SHEET_METADATA_FORBIDDEN',
      'Prompt-sheet metadata is only valid for shot.video-prompt-sheet specs.',
      { issues }
    );
  }
}

function isVideoPromptSheetVisualStyleId(value: unknown): boolean {
  return value === 'cinematic-realistic' || value === 'handdrawn-storyboard';
}

function isVideoPromptSheetNotationModeId(value: unknown): boolean {
  return value === 'none' || value === 'motion-annotation';
}
