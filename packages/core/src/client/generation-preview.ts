import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { GenerationCostEstimate } from '@gorenku/studio-engines';
import type { SceneShotVideoTakeTarget } from './media-generation-target.js';
import type {
  VideoPromptSheetNotationModeId,
  VideoPromptSheetVisualStyleId,
} from './shot-video-take.js';

export type GenerationPreviewPurpose =
  | 'shot.video-prompt-sheet'
  | 'shot.video-take';

export interface GenerationPreviewRequest {
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
  references: GenerationPreviewRequestReference[];
  configuration: GenerationPreviewConfigurationItem[];
  providerPreview?: GenerationPreviewProviderPreview;
  estimate?: GenerationPreviewEstimate;
  diagnostics: DiagnosticIssue[];
}

export interface StudioGenerationPreview
  extends Omit<GenerationPreviewRequest, 'references'> {
  subject: StudioGenerationPreviewSubject;
  references: StudioGenerationPreviewReference[];
}

export interface StudioGenerationPreviewSubject {
  projectLabel: string;
  sceneLabel?: string;
  takeLabel?: string;
  shotLabel?: string;
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

export type GenerationPreviewRequestReference =
  | {
      kind: 'image';
      role: string;
      label: string;
      providerToken?: string;
      assetId: string;
      assetFileId: string;
      sourcePurpose?: string;
      selected: boolean;
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
    }
  | {
      kind: 'video';
      role: string;
      label: string;
      providerToken?: string;
      assetId: string;
      assetFileId: string;
      selected: boolean;
    };

export type StudioGenerationPreviewReference =
  GenerationPreviewRequestReference & {
    browserUrl: string;
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
  costEstimate?: GenerationCostEstimate;
  warnings?: string[];
}
