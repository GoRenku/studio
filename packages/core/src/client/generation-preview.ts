import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { GenerationCostEstimate } from '@gorenku/studio-engines';
import type { MediaGenerationTarget } from './media-generation-target.js';
import type {
  VideoPromptSheetNotationModeId,
  VideoPromptSheetVisualStyleId,
} from './shot-video-take.js';

export type GenerationPreviewPurpose =
  | 'shot.video-prompt-sheet'
  | 'shot.video-take'
  | 'cast.character-sheet';

export interface GenerationPreviewRequest {
  kind: 'generationPreview';
  previewId: string;
  generationSpecId?: string;
  purpose: GenerationPreviewPurpose;
  project: {
    id: string;
    name: string;
    title?: string;
  };
  target: MediaGenerationTarget;
  title: string;
  model: GenerationPreviewModel;
  promptSheetVisualStyleId?: VideoPromptSheetVisualStyleId;
  promptSheetNotationModeId?: VideoPromptSheetNotationModeId;
  finalPrompt: GenerationPreviewPrompt;
  references: GenerationPreviewRequestReference[];
  configuration: GenerationPreviewConfiguration;
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
  castMemberLabel?: string;
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
      selectionControl?: GenerationPreviewReferenceSelectionControl;
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
      selectionControl?: GenerationPreviewReferenceSelectionControl;
    }
  | {
      kind: 'video';
      role: string;
      label: string;
      providerToken?: string;
      assetId: string;
      assetFileId: string;
      selected: boolean;
      selectionControl?: GenerationPreviewReferenceSelectionControl;
    };

export interface GenerationPreviewReferenceSelectionControl {
  dependencyId: string;
  required: boolean;
  defaultIncluded: boolean;
  inclusionOverride: 'include' | 'exclude' | null;
  editable: boolean;
}

export type StudioGenerationPreviewReference =
  GenerationPreviewRequestReference & {
    browserUrl: string;
  };

export type GenerationPreviewConfigurationValue =
  | string
  | number
  | boolean
  | null
  | { kind: 'dimensions'; width: number; height: number }
  | Array<string | number | boolean>;

export type GenerationPreviewConfigurationValueSource =
  | 'spec'
  | 'context-default'
  | 'renku-fixed'
  | 'provider-default'
  | 'derived'
  | 'model-capability'
  | 'provider-route';

export type GenerationPreviewConfigurationRowPresentation =
  | 'static'
  | 'parameter-control';

export interface GenerationPreviewConfiguration {
  sections: GenerationPreviewConfigurationSection[];
}

export interface GenerationPreviewConfigurationSection {
  key: string;
  label: string;
  rows: GenerationPreviewConfigurationRow[];
}

export interface GenerationPreviewConfigurationRow {
  key: string;
  label: string;
  value: GenerationPreviewConfigurationValue;
  valueLabel?: string;
  providerField?: string;
  schemaDefault?: GenerationPreviewConfigurationValue;
  schemaDefaultLabel?: string;
  allowedValues?: GenerationPreviewConfigurationValue[];
  minimum?: number;
  maximum?: number;
  required?: boolean;
  source: GenerationPreviewConfigurationValueSource;
  emphasis?: 'primary' | 'secondary';
  presentation?: GenerationPreviewConfigurationRowPresentation;
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
