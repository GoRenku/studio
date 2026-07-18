import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  GenerationModelIdentity,
  GenerationRun,
  GenerationSpecRecord,
} from './generation.js';
import type { JsonValue } from './generation.js';
import type {
  GenerationEditorControl,
  GenerationPreviewConfigurationValue,
  GenerationPreviewResourceData,
} from './generation-preview-resource.js';

export type ImageRevisionTarget =
  | {
      kind: 'castCharacterSheet';
      castMemberId: string;
      assetId: string;
      assetFileId: string;
    }
  | {
      kind: 'locationEnvironmentSheet';
      locationId: string;
      assetId: string;
      assetFileId: string;
    }
  | {
      kind: 'lookbookImage';
      lookbookId: string;
      imageId: string;
      assetId: string;
      assetFileId: string;
    }
  | {
      kind: 'lookbookSheet';
      lookbookId: string;
      sheetId: string;
      assetId: string;
      assetFileId: string;
    };

export type ImageRevisionMode = 'regenerate' | 'edit';

export interface ImageRevisionDraft {
  mode: ImageRevisionMode;
  model: Required<GenerationModelIdentity>;
  authoredText: string;
  negativeText?: string;
  generationControls: Array<{
    controlId: string;
    value: GenerationPreviewConfigurationValue;
  }>;
}

export type ImageRevisionModeContext =
  | {
      state: 'available';
      mode: ImageRevisionMode;
      draft: ImageRevisionDraft;
      preview: GenerationPreviewResourceData;
      controls: GenerationEditorControl[];
      diagnostics: DiagnosticIssue[];
    }
  | {
      state: 'unavailable';
      mode: ImageRevisionMode;
      diagnostics: DiagnosticIssue[];
    };

export interface ImageRevisionEditorContext {
  target: ImageRevisionTarget;
  source: {
    title: string;
    assetId: string;
    assetFileId: string;
  };
  sourceGenerationRequest: ImageRevisionSourceRequest | null;
  regenerate: ImageRevisionModeContext;
  edit: ImageRevisionModeContext;
}

export interface ImageRevisionSourceRequest {
  model?: GenerationModelIdentity;
  values: Record<string, JsonValue>;
  referenceLabels: string[];
}

export interface ImageRevisionEstimateReport {
  preview: GenerationPreviewResourceData;
  estimatedUsd: number | null;
  diagnostics: DiagnosticIssue[];
}

export interface ImageRevisionRunReport {
  spec: GenerationSpecRecord;
  run: GenerationRun;
  imported: {
    assetId: string;
    assetFileId: string;
  };
  resourceKeys: string[];
}
