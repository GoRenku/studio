import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { GenerationEstimate } from '@gorenku/studio-engines';
import type { SceneShotVideoTakeTarget } from './media-generation-target.js';
import type {
  VideoPromptSheetNotationModeId,
  VideoPromptSheetVisualStyleId,
} from './shot-video-take.js';

export type GenerationPreviewPurpose =
  | 'shot.video-prompt-sheet'
  | 'shot.video-take';

export interface GenerationPreviewSnapshot {
  kind: 'generationPreview';
  previewId: string;
  purpose: GenerationPreviewPurpose;
  project: {
    id: string;
    name: string;
    title?: string;
  };
  target: SceneShotVideoTakeTarget;
  title: string;
  model: GenerationPreviewModel;
  promptSheetVisualStyleId?: VideoPromptSheetVisualStyleId;
  promptSheetNotationModeId?: VideoPromptSheetNotationModeId;
  finalPrompt: GenerationPreviewPrompt;
  references: GenerationPreviewReference[];
  configuration: GenerationPreviewConfigurationItem[];
  providerPreview?: GenerationPreviewProviderPreview;
  estimate?: GenerationPreviewEstimate;
  diagnostics: DiagnosticIssue[];
}

export interface GenerationPreviewModel {
  provider: string;
  modelId: string;
  route?: string;
  executionPath?: 'renku-managed' | 'codex-external' | 'external';
  mediaKind: 'image' | 'video';
}

export interface GenerationPreviewPrompt {
  text: string;
  negativePrompt?: string;
}

export type GenerationPreviewReference =
  | {
      kind: 'image';
      role: string;
      label: string;
      providerToken?: string;
      assetId: string;
      assetFileId: string;
      sourcePurpose?: string;
      selected: boolean;
      browserUrl?: string;
    }
  | {
      kind: 'audio';
      role: string;
      label: string;
      providerToken?: string;
      assetId: string;
      assetFileId: string;
      dialogueId?: string;
      selected: boolean;
      browserUrl?: string;
    }
  | {
      kind: 'video';
      role: string;
      label: string;
      providerToken?: string;
      assetId: string;
      assetFileId: string;
      selected: boolean;
      browserUrl?: string;
    };

export interface GenerationPreviewConfigurationItem {
  key: string;
  label: string;
  value: string | number | boolean | null | string[] | number[] | boolean[];
}

export interface GenerationPreviewProviderPreview {
  provider: string;
  model: string;
  mode?: string;
  providerTokenOrder?: string[];
  payload?: Record<string, unknown>;
}

export interface GenerationPreviewEstimate {
  state: 'not-estimated' | 'estimated' | 'unpriced';
  estimatedCostUsd?: number | null;
  engineEstimate?: GenerationEstimate;
  warnings?: string[];
}
