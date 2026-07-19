import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  GenerationPurpose,
  GenerationReferenceSelection,
  GenerationTarget,
  JsonValue,
} from './generation.js';

export type GenerationPreviewPurpose = Exclude<
  GenerationPurpose,
  'cast.voice-sample' | 'scene.dialogue-audio'
>;

export interface GenerationPreviewResource {
  kind: 'generationPreview';
  previewId: string;
  generationSpec?: {
    id: string;
    frozenAt: string | null;
  };
  purpose: GenerationPreviewPurpose;
  project: {
    id: string;
    name: string;
    title?: string;
  };
  target: GenerationTarget;
  title: string;
  subject: GenerationPreviewSubject;
  model: GenerationPreviewModel;
  promptSheetVisualStyleId?:
    | 'cinematic-realistic'
    | 'handdrawn-storyboard';
  promptSheetNotationModeId?: 'none' | 'motion-annotation';
  finalPrompt: GenerationPreviewPrompt;
  references: GenerationPreviewReferences;
  configuration: GenerationPreviewConfiguration;
  authoring: GenerationPreviewAuthoring;
  providerPreview?: GenerationPreviewProviderPreview;
  estimate?: GenerationPreviewEstimate;
  diagnostics: DiagnosticIssue[];
}

export interface GenerationPreviewSubject {
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
  executionPath?: 'renku-managed' | 'agent-external';
  mediaKind: 'image' | 'audio' | 'video';
}

export interface GenerationPreviewPrompt {
  authoredText: string;
  providerText: string;
  negativeText?: string;
}

export interface GenerationPreviewResourceReference {
  kind: 'image' | 'audio' | 'video';
  role: string;
  label: string;
  promptMention?: string;
  assetId: string;
  assetFileId: string;
  dialogueId?: string;
  sourcePurpose?: string;
  selected: boolean;
  browserUrl: string;
}

export interface GenerationPreviewReferences {
  slots: GenerationPreviewReferenceSlot[];
  additional: GenerationPreviewResourceReference[];
}

export interface GenerationPreviewReferenceSlot {
  label: string;
  locked: boolean;
  placement: Extract<
    GenerationReferenceSelection['placement'],
    { kind: 'slot' }
  >;
  current: GenerationPreviewResourceReference | null;
  eligibleCandidates: GenerationPreviewResourceReference[];
}

export type GenerationPreviewResourceData = Omit<
  GenerationPreviewResource,
  'references'
> & {
  references: {
    slots: Array<Omit<GenerationPreviewReferenceSlot, 'current' | 'eligibleCandidates'> & {
      current: Omit<GenerationPreviewResourceReference, 'browserUrl'> | null;
      eligibleCandidates: Array<Omit<GenerationPreviewResourceReference, 'browserUrl'>>;
    }>;
    additional: Array<Omit<GenerationPreviewResourceReference, 'browserUrl'>>;
  };
};

export type GenerationPreviewConfigurationValue =
  | string
  | number
  | boolean
  | null
  | { kind: 'dimensions'; width: number; height: number }
  | Array<string | number | boolean>;

export type GenerationEditorControl =
  | {
      controlId: string;
      kind: 'readonly';
      label: string;
      value: GenerationPreviewConfigurationValue;
      authored?: boolean;
      recommended?: boolean;
    }
  | {
      controlId: string;
      kind: 'select';
      label: string;
      value: GenerationPreviewConfigurationValue;
      required: boolean;
      authored?: boolean;
      recommended?: boolean;
      options: Array<{
        label: string;
        value: GenerationPreviewConfigurationValue;
      }>;
    }
  | {
      controlId: string;
      kind: 'number';
      label: string;
      value: number | null;
      required: boolean;
      authored?: boolean;
      recommended?: boolean;
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      controlId: string;
      kind: 'toggle';
      label: string;
      value: boolean;
      required: boolean;
      authored?: boolean;
      recommended?: boolean;
    }
  | {
      controlId: string;
      kind: 'text';
      label: string;
      value: string | null;
      required: boolean;
      authored?: boolean;
      recommended?: boolean;
    };

export interface GenerationPreviewAuthoring {
  selectedModelFamilyId: string;
  modelFamilies: Array<{
    familyId: string;
    label: string;
  }>;
  controls: GenerationEditorControl[];
}

export type GenerationPreviewConfigurationValueSource =
  | 'spec'
  | 'context-default'
  | 'renku-fixed'
  | 'provider-default'
  | 'derived'
  | 'model-capability'
  | 'provider-route';

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
  allowedValueLabels?: Record<string, string>;
  minimum?: number;
  maximum?: number;
  required?: boolean;
  source: GenerationPreviewConfigurationValueSource;
  emphasis?: 'primary' | 'secondary';
  presentation?: 'static' | 'parameter-control';
}

export interface GenerationPreviewProviderPreview {
  provider: string;
  model: string;
  mode?: string;
  providerTokenOrder?: string[];
  payload?: Record<string, JsonValue>;
}

export type GenerationPreviewEstimate =
  | { state: 'not-estimated'; warnings?: string[] }
  | {
      state: 'estimated';
      estimatedCostUsd: number;
      warnings?: string[];
    }
  | { state: 'unpriced'; estimatedCostUsd?: null; warnings?: string[] };
